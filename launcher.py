import os
import sys
import subprocess
import webbrowser
import time

def main():
    # Determine the root directory (where the exe is located)
    if getattr(sys, 'frozen', False):
        root_dir = os.path.dirname(sys.executable)
    else:
        root_dir = os.path.dirname(os.path.abspath(__file__))

    business_os_dir = os.path.join(root_dir, "business-os")

    print("=" * 60)
    print("  Lines & Logos - Business OS Launcher")
    print("=" * 60)
    print(f"Root: {root_dir}")
    print(f"App:  {business_os_dir}")
    print()

    if not os.path.exists(business_os_dir):
        print("ERROR: business-os directory not found!")
        print(f"Expected at: {business_os_dir}")
        input("Press Enter to exit...")
        return

    os.chdir(business_os_dir)

    # Check if node_modules exists
    node_modules = os.path.join(business_os_dir, "node_modules")
    if not os.path.exists(node_modules):
        print("Installing dependencies (this may take a few minutes)...")
        try:
            subprocess.run(["npm", "install"], check=True, shell=True)
            print("Dependencies installed successfully!")
        except subprocess.CalledProcessError as e:
            print(f"ERROR: npm install failed: {e}")
            input("Press Enter to exit...")
            return
    else:
        print("Dependencies already installed.")

    # Check if .env.local exists
    env_file = os.path.join(business_os_dir, ".env.local")
    if not os.path.exists(env_file):
        env_example = os.path.join(business_os_dir, ".env.example")
        if os.path.exists(env_example):
            import shutil
            shutil.copy(env_example, env_file)
            print("Created .env.local from .env.example")

    # Check if database exists
    db_file = os.path.join(business_os_dir, "prisma", "dev.db")
    if not os.path.exists(db_file):
        print("Setting up database...")
        try:
            subprocess.run(["npx", "prisma", "db", "push"], check=True, shell=True)
            print("Database created!")
            subprocess.run(["npm", "run", "db:seed"], check=True, shell=True)
            print("Database seeded!")
        except subprocess.CalledProcessError as e:
            print(f"WARNING: Database setup failed: {e}")

    print()
    print("Starting development server...")
    print("The app will open in your browser at http://localhost:3001")
    print("Press Ctrl+C to stop the server.")
    print()

    # Open browser after a short delay
    import threading
    def open_browser():
        time.sleep(8)
        webbrowser.open("http://localhost:3001")
    threading.Thread(target=open_browser, daemon=True).start()

    # Start the dev server
    try:
        subprocess.run(["npm", "run", "dev"], shell=True)
    except KeyboardInterrupt:
        print("\nServer stopped.")

    input("Press Enter to exit...")

if __name__ == "__main__":
    main()