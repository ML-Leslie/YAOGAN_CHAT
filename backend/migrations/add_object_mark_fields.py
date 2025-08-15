"""
数据库迁移脚本 - 添加物体标记相关字段
"""
import sqlite3

def run_migration():
    print("开始运行迁移脚本...")
    
    # 连接到SQLite数据库
    conn = sqlite3.connect('yaogan_chat.db')
    cursor = conn.cursor()
    
    try:
        # 检查是否已存在object_coordinates列
        cursor.execute("PRAGMA table_info(messages)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'object_coordinates' not in columns:
            print("添加object_coordinates列...")
            cursor.execute("ALTER TABLE messages ADD COLUMN object_coordinates TEXT")
        
        if 'is_object_mark' not in columns:
            print("添加is_object_mark列...")
            cursor.execute("ALTER TABLE messages ADD COLUMN is_object_mark BOOLEAN DEFAULT 0")
        
        # 提交更改
        conn.commit()
        print("迁移完成!")
        
    except Exception as e:
        # 回滚更改
        conn.rollback()
        print(f"迁移失败: {e}")
        
    finally:
        # 关闭连接
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
