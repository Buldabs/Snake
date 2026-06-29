from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import (
    init_db, get_or_create_player, save_game_result,
    get_top_records, get_player_stats, clear_records, get_global_stats
)
import os

# Папка с фронтендом (на уровень выше, в папку frontend)
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend')

app = Flask(__name__)
CORS(app)

# Инициализируем БД при запуске
init_db()

# ============================================================
#  ОТДАЧА ФРОНТЕНДА
# ============================================================

@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(FRONTEND_DIR, path)

# ============================================================
#  API
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Snake API работает!'})

@app.route('/api/records', methods=['GET'])
def get_records():
    try:
        records = get_top_records(10)
        return jsonify(records)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/game', methods=['POST'])
def save_game():
    try:
        data = request.get_json()
        required = ['username', 'score', 'level', 'food_eaten', 'duration', 'result']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Отсутствует поле: {field}'}), 400
        
        player_id = get_or_create_player(data['username'])
        save_game_result(
            player_id,
            data['score'],
            data['level'],
            data['food_eaten'],
            data['duration'],
            data['result']
        )
        return jsonify({'status': 'ok', 'player_id': player_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats/<username>', methods=['GET'])
def get_stats(username):
    try:
        from database import get_db_connection
        conn = get_db_connection()
        player = conn.execute('SELECT id FROM players WHERE username = ?', (username,)).fetchone()
        conn.close()
        if not player:
            return jsonify({'error': 'Игрок не найден'}), 404
        stats = get_player_stats(player['id'])
        stats['username'] = username
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats/global', methods=['GET'])
def get_global_stats_route():
    try:
        stats = get_global_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/records', methods=['DELETE'])
def delete_records():
    try:
        clear_records()
        return jsonify({'status': 'ok', 'message': 'Рекорды очищены'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)