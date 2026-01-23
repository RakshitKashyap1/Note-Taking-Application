from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Note, Tag, NoteShare, User
from datetime import datetime

notes = Blueprint('notes', __name__)

@notes.route('/')
@notes.route('/dashboard')
def dashboard():
    return render_template('notes/dashboard.html', user=current_user)

@notes.route('/sw.js')
def service_worker():
    from flask import send_from_directory
    import os
    return send_from_directory(os.path.join(notes.root_path, '../static/js'), 'sw.js')

@notes.route('/notes', methods=['GET', 'POST'])
@login_required
def handle_notes():
    if request.method == 'POST':
        data = request.get_json()
        if not data:
             return jsonify({'error': 'Invalid request'}), 400
             
        title = data.get('title')
        content = data.get('content')
        tag_names = data.get('tags', [])
        is_pinned = data.get('is_pinned', False)

        if not title or not content:
            return jsonify({'error': 'Title and Content required'}), 400

        note = Note(title=title, content=content, is_pinned=is_pinned, author=current_user)
        
        # Handle tags
        # tag_names should be a list of strings
        if isinstance(tag_names, str):
            tag_names = [t.strip() for t in tag_names.split(',')]
        
        # Deduplicate tags
        tag_names = list(set([t for t in tag_names if t]))

        for name in tag_names:
            name = name.strip()
            if not name: continue
            tag = Tag.query.filter_by(name=name).first()
            if not tag:
                tag = Tag(name=name)
                db.session.add(tag)
                # Flush to ensure it's available for subsequent queries if multiple notes were being added (batch)
                # Though here we only add one note, but good practice if logic changes
                # db.session.flush() 
            note.tags.append(tag)
        
        db.session.add(note)
        db.session.commit()
        db.session.add(note)
        db.session.commit()
        return jsonify({
            'message': 'Note created', 
            'id': note.id, 
            'title': note.title, 
            'is_pinned': note.is_pinned,
            'date_posted': note.date_posted.strftime('%Y-%m-%d %H:%M'),
            'date_updated': note.date_updated.strftime('%Y-%m-%d %H:%M')
        }), 201
    
    # GET
    search_query = request.args.get('q')
    
    # Get notes owned by or shared with the user
    query = Note.query.outerjoin(NoteShare).filter(
        (Note.user_id == current_user.id) | (NoteShare.user_id == current_user.id)
    )
    
    if search_query:
        query = query.filter((Note.title.ilike(f'%{search_query}%')) | (Note.content.ilike(f'%{search_query}%')))
    
    tag_filter = request.args.get('tag')
    if tag_filter:
        query = query.filter(Note.tags.any(Tag.name == tag_filter))

    user_notes = query.order_by(Note.is_pinned.desc(), Note.date_posted.desc()).all()
    
    notes_data = []
    for n in user_notes:
        share_info = NoteShare.query.filter_by(note_id=n.id, user_id=current_user.id).first()
        permission = 'owner' if n.user_id == current_user.id else (share_info.permission if share_info else 'none')
        
        notes_data.append({
            'id': n.id,
            'title': n.title,
            'content': n.content,
            'is_pinned': n.is_pinned,
            'date_posted': n.date_posted.strftime('%Y-%m-%d %H:%M'),
            'date_updated': n.date_updated.strftime('%Y-%m-%d %H:%M') if n.date_updated else n.date_posted.strftime('%Y-%m-%d %H:%M'),
            'reminder_date': n.reminder_date.strftime('%Y-%m-%dT%H:%M') if n.reminder_date else None,
            'tags': [t.name for t in n.tags],
            'permission': permission,
            'owner': n.author.username
        })
        
    return jsonify(notes_data)

@notes.route('/notes/<int:note_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def note_detail(note_id):
    note = Note.query.get_or_404(note_id)
    
    # Check if user has access
    share_info = NoteShare.query.filter_by(note_id=note_id, user_id=current_user.id).first()
    is_owner = note.author == current_user
    permission = 'owner' if is_owner else (share_info.permission if share_info else None)

    if not is_owner and not share_info:
        return jsonify({'error': 'Forbidden'}), 403

    if request.method == 'DELETE':
        if not is_owner:
            return jsonify({'error': 'Only owners can delete notes'}), 403
        db.session.delete(note)
        db.session.commit()
        return jsonify({'message': 'Deleted'})
    
    if request.method == 'PUT':
        if permission != 'owner' and permission != 'write':
            return jsonify({'error': 'No write permission'}), 403
            
        data = request.get_json()
        note.title = data.get('title', note.title)
        note.content = data.get('content', note.content)
        note.is_pinned = data.get('is_pinned', note.is_pinned)
        
        reminder_str = data.get('reminder_date')
        if reminder_str:
            try:
                note.reminder_date = datetime.strptime(reminder_str, '%Y-%m-%dT%H:%M')
            except ValueError:
                pass # Or handle error
        elif 'reminder_date' in data:
            note.reminder_date = None

        note.date_updated = datetime.utcnow()
        
        if 'tags' in data:
            note.tags = []
            tag_names = data.get('tags', [])
            if isinstance(tag_names, str):
                tag_names = [t.strip() for t in tag_names.split(',')]
            
            for name in tag_names:
                name = name.strip()
                if not name: continue
                tag = Tag.query.filter_by(name=name).first()
                if not tag:
                    tag = Tag(name=name)
                    db.session.add(tag)
                note.tags.append(tag)

        db.session.commit()
        return jsonify({'message': 'Updated'})

    return jsonify({
        'id': note.id, 
        'title': note.title, 
        'content': note.content,
        'is_pinned': note.is_pinned,
        'reminder_date': note.reminder_date.strftime('%Y-%m-%dT%H:%M') if note.reminder_date else None,
        'tags': [t.name for t in note.tags],
        'permission': permission,
        'owner': note.author.username
    })

@notes.route('/notes/<int:note_id>/share', methods=['POST'])
@login_required
def share_note(note_id):
    note = Note.query.get_or_404(note_id)
    if note.author != current_user:
        return jsonify({'error': 'Only owners can share notes'}), 403
    
    data = request.get_json()
    username = data.get('username')
    permission = data.get('permission', 'read')
    
    user_to_share = User.query.filter_by(username=username).first()
    if not user_to_share:
        return jsonify({'error': 'User not found'}), 404
        
    if user_to_share == current_user:
        return jsonify({'error': 'Cannot share with yourself'}), 400
        
    existing_share = NoteShare.query.filter_by(note_id=note_id, user_id=user_to_share.id).first()
    if existing_share:
        existing_share.permission = permission
    else:
        new_share = NoteShare(note_id=note_id, user_id=user_to_share.id, permission=permission)
        db.session.add(new_share)
        
    db.session.commit()
    return jsonify({'message': f'Shared with {username}'})

@notes.route('/notes/ai-tools', methods=['POST'])
@login_required
def ai_tools():
    data = request.get_json()
    content = data.get('content', '')
    tool = data.get('tool', 'summarize') # 'summarize' or 'tags'
    
    if not content:
        return jsonify({'error': 'No content provided'}), 400
        
    # AI Logic Mockup
    if tool == 'summarize':
        # Simple summarization mock: take first few sentences
        sentences = content.split('.')
        summary = '. '.join(sentences[:2]) + ('.' if len(sentences) > 2 else '')
        if not summary: summary = content[:100] + '...'
        return jsonify({'result': summary})
    
    elif tool == 'tags':
        # Simple auto-tagging mock: extract common words
        words = content.lower().split()
        # Filter some stop words
        stop_words = {'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'in', 'for', 'it', 'with', 'as', 'that'}
        filtered_words = [w.strip('.,!?;:') for w in words if w not in stop_words and len(w) > 4]
        from collections import Counter
        common_words = [w for w, c in Counter(filtered_words).most_common(5)]
        return jsonify({'result': common_words})
        
    return jsonify({'error': 'Invalid tool'}), 400

@notes.route('/users/search', methods=['GET'])
@login_required
def search_users():
    q = request.args.get('q', '')
    if not q:
        return jsonify([])
    users = User.query.filter(User.username.ilike(f'%{q}%'), User.id != current_user.id).limit(5).all()
    return jsonify([{'username': u.username} for u in users])
