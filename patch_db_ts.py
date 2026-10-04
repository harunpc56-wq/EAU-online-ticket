import re

with open('services/db.ts', 'r') as f:
    content = f.read()

# Replace the setInterval with SSE
old_interval = '''    // Real-time server polling synchronization (every 1 second)
    if (typeof window !== 'undefined') {
      setInterval(async () => {
        try {
          const res = await fetch('/api/db');
          if (res.ok) {
            const serverData = await res.json();
            if (serverData && typeof serverData === 'object') {
              const currentStr = JSON.stringify(this.memoryDb);
              const serverStr = JSON.stringify(serverData);
              if (currentStr !== serverStr) {
                Object.assign(this.memoryDb, serverData);
                this.notify();
              }
            }
          }
        } catch (err) {
          // Silent background poll error handling
        }
      }, 1000);
    }'''

new_sse = '''    // Real-time server SSE synchronization
    if (typeof window !== 'undefined') {
      const connectSSE = () => {
        const eventSource = new EventSource('/api/db/stream');
        eventSource.onmessage = async (event) => {
           if (event.data === 'update') {
               try {
                   const res = await fetch('/api/db');
                   if (res.ok) {
                       const serverData = await res.json();
                       if (serverData && typeof serverData === 'object') {
                           Object.assign(this.memoryDb, serverData);
                           this.notify();
                       }
                   }
               } catch (e) {}
           }
        };
        eventSource.onerror = () => {
            eventSource.close();
            setTimeout(connectSSE, 3000);
        };
      };
      connectSSE();
      
      // Keep a slower fallback polling just in case SSE fails
      setInterval(async () => {
        try {
          const res = await fetch('/api/db');
          if (res.ok) {
            const serverData = await res.json();
            if (serverData && typeof serverData === 'object') {
              const currentStr = JSON.stringify(this.memoryDb);
              const serverStr = JSON.stringify(serverData);
              if (currentStr !== serverStr) {
                Object.assign(this.memoryDb, serverData);
                this.notify();
              }
            }
          }
        } catch (err) {}
      }, 5000);
    }'''

if old_interval in content:
    content = content.replace(old_interval, new_sse)
    with open('services/db.ts', 'w') as f:
        f.write(content)
    print("SSE patched in db.ts successfully.")
else:
    print("Could not find the interval code in db.ts")
