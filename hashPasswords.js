const bcrypt = require('bcryptjs');

async function run() {
  const adminPassword = await bcrypt.hash('JP1234@', 10);
  const userPassword = await bcrypt.hash('julana1234@', 10);

  console.log('Admin hashed:', adminPassword);
  console.log('User hashed:', userPassword);
}

run();
