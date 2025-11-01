import re
import uuid

def add_unique_keys(filename):
    """Add unique 16 chars to ONLY story keys (not property names)"""
    
    print(f"Adding unique keys to {filename}...")
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return
    
    # Create backup
    import shutil
    backup_file = filename + '.backup'
    shutil.copy2(filename, backup_file)
    print(f"✅ Backup created: {backup_file}")
    
    # Find ONLY story keys (keys that start the object)
    def add_unique_id(match):
        key = match.group(1)
        unique_id = str(uuid.uuid4()).replace('-', '')[:16]  # 16 char without dashes
        new_key = f"{key}_{unique_id}"
        print(f"Story Key: {key} -> {new_key}")
        return f'"{new_key}": {{'
    
    # Replace ONLY story keys (look for pattern: "key": { )
    new_content = re.sub(r'"([a-z0-9\-]+)"\s*:\s*{', add_unique_id, content)
    
    # Write back
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ Complete! Only story keys have unique IDs")
        
    except Exception as e:
        print(f"❌ Error writing file: {e}")

# Run directly
add_unique_keys(r".\JS\utils\stories.js")