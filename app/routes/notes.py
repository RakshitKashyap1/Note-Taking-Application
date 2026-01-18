from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from app import db
from app.models import Note, Tag

notes = Blueprint('notes', __name__)

@notes.route('/')
@notes.route('/dashboard')
@login_required
def dashboard():
    return render_template('notes/dashboard.html', user=current_user)

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

        if not title or not content:
            return jsonify({'error': 'Title and Content required'}), 400

        note = Note(title=title, content=content, author=current_user)
        
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
        return jsonify({'message': 'Note created', 'id': note.id, 'title': note.title, 'date_posted': note.date_posted.strftime('%Y-%m-%d %H:%M')}), 201
    
    # GET
    search_query = request.args.get('q')
    query = Note.query.filter_by(user_id=current_user.id)
    
    if search_query:
        query = query.filter((Note.title.ilike(f'%{search_query}%')) | (Note.content.ilike(f'%{search_query}%')))
    
    user_notes = query.order_by(Note.date_posted.desc()).all()
    
    notes_data = []
    for n in user_notes:
        notes_data.append({
            'id': n.id,
            'title': n.title,
            'content': n.content,
            'date_posted': n.date_posted.strftime('%Y-%m-%d %H:%M'),
            'tags': [t.name for t in n.tags]
        })
        
    return jsonify(notes_data)

@notes.route('/notes/<int:note_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def note_detail(note_id):
    note = Note.query.get_or_404(note_id)
    if note.author != current_user:
        return jsonify({'error': 'Forbidden'}), 403

    if request.method == 'DELETE':
        db.session.delete(note)
        db.session.commit()
        return jsonify({'message': 'Deleted'})
    
    if request.method == 'PUT':
        data = request.get_json()
        note.title = data.get('title', note.title)
        note.content = data.get('content', note.content)
        
        if 'tags' in data:
            # Clear existing tags and set new ones? Or merge?
            # Typically replace for PUT
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
        'tags': [t.name for t in note.tags]
    })
