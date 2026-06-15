fetch('http://localhost:3000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'student', password: '123' })
}).then(r => r.text()).then(console.log).catch(console.error);
