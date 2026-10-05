# #!/usr/bin/env python3
# """
# MySQL Reset Script - Runs on shutdown
# Resets users table passwords (id 1-5) and cleans up extra rows
# """

# import re
# import traceback
# import mysql.connector
# import sys
# import logging
# import os
# from pathlib import Path

# # Database configuration
# DB_CONFIG = {
#     'user': 'john',
#     'password': 'johnPassword!@#$%',
#     'host': 'localhost',
#     'database': 'userdb'
# }

# # Original passwords for id 1-5
# ORIGINAL_PASSWORDS = [
#     "Z8ctUXdmoIxsgG0wqMWU",  # id=1
#     "dC9Zzr70eBBEBrC30JZn",  # id=2
#     "8dQNDAPGy0zipvqrpdZ8",  # id=3
#     "xQV57Bym4ySIkadGd6XF",  # id=4
#     "LIuckg3TaF0FbSVmALKF"   # id=5
# ]

# # JSON file path
# USERS_JSON_PATH = '/var/www/html/assets/users.json'

# # Logging setup
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(levelname)s - %(message)s',
#     handlers=[
#         logging.FileHandler('/var/log/mysql-reset.log'),
#         logging.StreamHandler()
#     ]
# )

# def test_db_connection():
#     """Test MySQL connection."""
#     try:
#         conn = mysql.connector.connect(**DB_CONFIG)
#         conn.close()
#         logging.info("[*] MySQL connection OK")
#         return True
#     except Exception as e:
#         logging.error(f"[!] MySQL connection failed: {e}")
#         return False

# def reset_user_passwords(cursor):
#     """Reset passwords for users id=1 to 5."""
#     logging.info("[*] Resetting passwords for users 1-5...")
    
#     for i, password in enumerate(ORIGINAL_PASSWORDS, 1):
#         try:
#             # Update password (assuming plain text storage)
#             sql = "UPDATE users SET password = %s WHERE id = %s"
#             cursor.execute(sql, (password, i))
            
#             # Verify update
#             cursor.execute("SELECT id, password FROM users WHERE id = %s", (i,))
#             result = cursor.fetchone()
            
#             if result and result[1] == password:
#                 logging.info(f"[*]User id={i}: password reset to {password[:8]}...")
#             else:
#                 logging.warning(f"[!] User id={i}: update verification failed")
                
#         except Exception as e:
#             logging.error(f"[!] User id={i} update failed: {e}")

# def cleanup_extra_users(cursor):
#     """Delete users with id > 5."""
#     logging.info("[*] Cleaning up users with id > 5...")
#     try:
#         cursor.execute("SELECT COUNT(*) FROM users WHERE id > 5")
#         count_before = cursor.fetchone()[0]
        
#         cursor.execute("DELETE FROM users WHERE id > 5")
#         deleted = cursor.rowcount
        
#         cursor.execute("SELECT COUNT(*) FROM users WHERE id > 5")
#         count_after = cursor.fetchone()[0]
        
#         logging.info(f"Deleted {deleted} users (before: {count_before}, after: {count_after})")
        
#     except Exception as e:
#         logging.error(f"[!] Cleanup failed: {e}")

# def reset_users_json():
#     """Change first 'false' to 'true' in users.json."""
#     try:
#         if not os.path.exists(USERS_JSON_PATH):
#             logging.warning(f"[!] {USERS_JSON_PATH} not found")
#             return False
        
#         with open(USERS_JSON_PATH, 'r') as f:
#             content = f.read()
        
#         # Try JSON formats first
#         patterns = [
#             r'"loggedIn":\s*false',  # "loggedIn": false
#             r'"loggedIn":false',     # "loggedIn":false
#             '"true"',                # "true" → "false" (unlikely but safe)
#             'false'                  # plain false
#         ]
        
#         updated = False
#         for pattern in patterns:
#             if re.search(pattern, content):
#                 content = re.sub(pattern, lambda m: m.group().replace('false', 'true'), content, count=1)
#                 updated = True
#                 break
        
#         if not updated:
#             logging.warning("[!] No 'false' found in users.json")
#             return False
        
#         with open(USERS_JSON_PATH, 'w') as f:
#             f.write(content)
        
#         logging.info(f"[*] users.json updated: first 'false' → 'true'")
#         return True
        
#     except Exception as e:
#         logging.error(f"[!] users.json update failed: {e}")
#         return False

# def main():
#     """Main reset function."""
#     logging.info("[*] MySQL Reset Script Started")
    
#     # Test connection
#     if not test_db_connection():
#         logging.error("[!] Exiting due to connection failure")
#         sys.exit(1)
    
#     try:
#         # Connect to database
#         conn = mysql.connector.connect(**DB_CONFIG)
#         cursor = conn.cursor()
        
#         # Perform resets
#         reset_user_passwords(cursor)
#         cleanup_extra_users(cursor)
#         reset_users_json()
        
#         # Commit changes
#         conn.commit()
#         logging.info("[*] All changes committed successfully")
        
#         # Verify final state
#         cursor.execute("SELECT id, password FROM users WHERE id <= 5 ORDER BY id")
#         users = cursor.fetchall()
#         logging.info(f"[*] Final state ({len(users)} users):")
#         for user in users:
#             logging.info(f"  id={user[0]}: {user[1][:8]}...")
        
#         conn.close()
#         logging.info("[*] Reset complete!")
#         sys.exit(0)
        
#     except Exception as e:
#         logging.error(f"[!] Fatal error: {e}")
#         traceback.print_exc()
#         sys.exit(1)

# if __name__ == "__main__":
#     main()
#!/usr/bin/env python3
"""
MySQL Reset Script - Runs on shutdown
Resets users table passwords (id 1-5) and cleans up extra rows
"""

import traceback
import mysql.connector
import sys
import logging
import os
import re
from pathlib import Path

# Database configuration
DB_CONFIG = {
    'user': 'john',
    'password': 'johnPassword!@#$%',
    'host': 'localhost',
    'database': 'userdb'
}

# Original passwords for id 1-5
ORIGINAL_PASSWORDS = [
    "Z8ctUXdmoIxsgG0wqMWU",  # id=1
    "dC9Zzr70eBBEBrC30JZn",  # id=2
    "8dQNDAPGy0zipvqrpdZ8",  # id=3
    "xQV57Bym4ySIkadGd6XF",  # id=4
    "LIuckg3TaF0FbSVmALKF"   # id=5
]

# JSON file path
USERS_JSON_PATH = '/var/www/html/assets/users.json'

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/mysql-reset.log'),
        logging.StreamHandler()
    ]
)

def test_db_connection():
    """Test MySQL connection."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        conn.close()
        logging.info("[*] MySQL connection OK")
        return True
    except Exception as e:
        logging.error(f"[!] MySQL connection failed: {e}")
        return False

def reset_user_passwords(cursor):
    """Reset passwords for users id=1 to 5."""
    logging.info("[*] Resetting passwords for users 1-5...")
    
    for i, password in enumerate(ORIGINAL_PASSWORDS, 1):
        try:
            # Update password (assuming plain text storage)
            sql = "UPDATE users SET password = %s WHERE id = %s"
            cursor.execute(sql, (password, i))
            
            # Verify update
            cursor.execute("SELECT id, password FROM users WHERE id = %s", (i,))
            result = cursor.fetchone()
            
            if result and result[1] == password:
                logging.info(f"[*]User id={i}: password reset to {password[:8]}...")
            else:
                logging.warning(f"[!] User id={i}: update verification failed")
                
        except Exception as e:
            logging.error(f"[!] User id={i} update failed: {e}")

def cleanup_extra_users(cursor):
    """Delete users with id > 5."""
    logging.info("[*] Cleaning up users with id > 5...")
    try:
        cursor.execute("SELECT COUNT(*) FROM users WHERE id > 5")
        count_before = cursor.fetchone()[0]
        
        cursor.execute("DELETE FROM users WHERE id > 5")
        deleted = cursor.rowcount
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE id > 5")
        count_after = cursor.fetchone()[0]
        
        logging.info(f"Deleted {deleted} users (before: {count_before}, after: {count_after})")
        
    except Exception as e:
        logging.error(f"[!] Cleanup failed: {e}")

def reset_users_json():
    """Change first 'false' to 'true' in users.json."""
    try:
        if not os.path.exists(USERS_JSON_PATH):
            logging.warning(f"[!] {USERS_JSON_PATH} not found")
            return False
        
        with open(USERS_JSON_PATH, 'r') as f:
            content = f.read()
        
        # Try JSON formats first
        patterns = [
            r'"loggedIn":\s*false',  # "loggedIn": false
            r'"loggedIn":false',     # "loggedIn":false
            '"true"',                # "true" → "false" (unlikely but safe)
            'false'                  # plain false
        ]
        
        updated = False
        for pattern in patterns:
            if re.search(pattern, content):
                content = re.sub(pattern, lambda m: m.group().replace('false', 'true'), content, count=1)
                updated = True
                break
        
        if not updated:
            logging.warning("[!] No 'false' found in users.json")
            return False
        
        with open(USERS_JSON_PATH, 'w') as f:
            f.write(content)
        
        logging.info(f"[*] users.json updated: first 'false' → 'true'")
        return True
        
    except Exception as e:
        logging.error(f"[!] users.json update failed: {e}")
        return False

def main():
    """Main reset function."""
    logging.info("[*] MySQL Reset Script Started")
    
    # Test connection
    if not test_db_connection():
        logging.error("[!] Exiting due to connection failure")
        sys.exit(1)
    
    try:
        # Connect to database
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Perform resets
        reset_user_passwords(cursor)
        cleanup_extra_users(cursor)
        reset_users_json()
        
        # Commit changes
        conn.commit()
        logging.info("[*] All changes committed successfully")
        
        # Verify final state
        cursor.execute("SELECT id, password FROM users WHERE id <= 5 ORDER BY id")
        users = cursor.fetchall()
        logging.info(f"[*] Final state ({len(users)} users):")
        for user in users:
            logging.info(f"  id={user[0]}: {user[1][:8]}...")
        
        conn.close()
        logging.info("[*] Reset complete!")
        sys.exit(0)
        
    except Exception as e:
        logging.error(f"[!] Fatal error: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()