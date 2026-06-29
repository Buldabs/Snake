import sqlite3
from datetime import datetime

DB_NAME = 'snake.db'

def get_db_connection():
    """Получить соединение с БД"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Создать таблицы, если их нет"""
    conn = get_db_connection()
    
    # Таблица игроков
    conn.execute('''
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Таблица игр (история)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            level INTEGER NOT NULL,
            food_eaten INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            result TEXT NOT NULL,
            date TEXT NOT NULL,
            FOREIGN KEY (player_id) REFERENCES players (id)
        )
    ''')
    
    # Таблица рекордов (для быстрого доступа к топу)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            score INTEGER NOT NULL,
            level INTEGER NOT NULL,
            date TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована")

def get_or_create_player(username):
    """Получить ID игрока или создать нового"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Проверяем, есть ли игрок
    cur.execute('SELECT id FROM players WHERE username = ?', (username,))
    row = cur.fetchone()
    
    if row:
        player_id = row['id']
    else:
        # Создаём нового
        cur.execute(
            'INSERT INTO players (username, created_at) VALUES (?, ?)',
            (username, datetime.now().isoformat())
        )
        conn.commit()
        player_id = cur.lastrowid
    
    conn.close()
    return player_id

def save_game_result(player_id, score, level, food_eaten, duration, result):
    """Сохранить результат игры"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Сохраняем в историю
    cur.execute('''
        INSERT INTO games (player_id, score, level, food_eaten, duration, result, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (player_id, score, level, food_eaten, duration, result, datetime.now().isoformat()))
    
    # Сохраняем в таблицу рекордов (только если результат хороший)
    # Получаем имя игрока
    cur.execute('SELECT username FROM players WHERE id = ?', (player_id,))
    player = cur.fetchone()
    if player:
        cur.execute('''
            INSERT INTO records (player_name, score, level, date)
            VALUES (?, ?, ?, ?)
        ''', (player['username'], score, level, datetime.now().isoformat()))
    
    conn.commit()
    conn.close()
    return True

def get_top_records(limit=10):
    """Получить топ-N рекордов"""
    conn = get_db_connection()
    records = conn.execute('''
        SELECT player_name, score, level, date
        FROM records
        ORDER BY score DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(row) for row in records]

def get_player_stats(player_id):
    """Получить статистику игрока"""
    conn = get_db_connection()
    
    # Количество игр
    games_count = conn.execute(
        'SELECT COUNT(*) as count FROM games WHERE player_id = ?',
        (player_id,)
    ).fetchone()['count']
    
    # Средний счёт
    avg_score = conn.execute(
        'SELECT AVG(score) as avg FROM games WHERE player_id = ?',
        (player_id,)
    ).fetchone()['avg'] or 0
    
    # Максимальный уровень
    max_level = conn.execute(
        'SELECT MAX(level) as max FROM games WHERE player_id = ?',
        (player_id,)
    ).fetchone()['max'] or 1
    
    # Лучший счёт
    best_score = conn.execute(
        'SELECT MAX(score) as best FROM games WHERE player_id = ?',
        (player_id,)
    ).fetchone()['best'] or 0
    
    conn.close()
    
    return {
        'games_played': games_count,
        'avg_score': round(avg_score, 1),
        'max_level': max_level,
        'best_score': best_score
    }

def clear_records():
    """Очистить таблицу рекордов (для администрирования)"""
    conn = get_db_connection()
    conn.execute('DELETE FROM records')
    conn.commit()
    conn.close()

def get_global_stats():
    """Получить глобальную статистику"""
    conn = get_db_connection()
    
    total_games = conn.execute('SELECT COUNT(*) as count FROM games').fetchone()['count']
    avg_score_all = conn.execute('SELECT AVG(score) as avg FROM games').fetchone()['avg'] or 0
    max_score = conn.execute('SELECT MAX(score) as max FROM games').fetchone()['max'] or 0
    total_players = conn.execute('SELECT COUNT(*) as count FROM players').fetchone()['count']
    
    conn.close()
    
    return {
        'total_games': total_games,
        'avg_score_all': round(avg_score_all, 1),
        'max_score': max_score,
        'total_players': total_players
    }