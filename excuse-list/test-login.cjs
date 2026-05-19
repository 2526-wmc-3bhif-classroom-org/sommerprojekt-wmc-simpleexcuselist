const { spawn } = require('child_process');

const server = spawn('npx', ['tsx', 'server/index.ts'], { shell: true });

server.stdout.on('data', async (data) => {
  const output = data.toString();
  console.log('[SERVER]', output);
  if (output.includes('Server running')) {
    try {
      const res = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testuser", password: "testpassword" })
      });
      console.log("Status:", res.status);
      console.log("Body:", await res.text());
    } catch(e) {
      console.error("Fetch error:", e);
    }
    server.kill();
    process.exit(0);
  }
});

server.stderr.on('data', (data) => {
  console.error('[SERVER ERROR]', data.toString());
});