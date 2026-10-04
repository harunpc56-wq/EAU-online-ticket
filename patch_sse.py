import re

with open('server.ts', 'r') as f:
    content = f.read()

# Add EventEmitter
if "import { EventEmitter } from 'events';" not in content:
    content = "import { EventEmitter } from 'events';\n" + content

if "const dbEvents = new EventEmitter();" not in content:
    content = content.replace("const app = express();", "const app = express();\nconst dbEvents = new EventEmitter();")

# Emit event in sync-all
content = content.replace('saveDatabase();\n          res.json({ status: "success" });', 'saveDatabase();\n          dbEvents.emit("update");\n          res.json({ status: "success" });')

# Emit event in /set
content = content.replace('saveDatabase();\n        res.json({ status: "success" });', 'saveDatabase();\n        dbEvents.emit("update");\n        res.json({ status: "success" });')

# Add SSE route
sse_route = '''
  app.get("/api/db/stream", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    const listener = () => {
      res.write("data: update\\n\\n");
    };
    
    dbEvents.on('update', listener);
    
    req.on('close', () => {
      dbEvents.off('update', listener);
    });
  });
'''
if "/api/db/stream" not in content:
    # insert before app.get("/api/db"
    content = content.replace('app.get("/api/db"', sse_route + '\n  app.get("/api/db"')

with open('server.ts', 'w') as f:
    f.write(content)
