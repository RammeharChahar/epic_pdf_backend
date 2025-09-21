const bcrypt = require('bcryptjs');

async function run() {
  const pass1 = await bcrypt.hash('safidon1234@', 10);
  const pass2 = await bcrypt.hash('jind1234@', 10);
  const pass3 = await bcrypt.hash('uchana1234@', 10);
  const pass4 = await bcrypt.hash('narwana1234@', 10);

  console.log('Admin hashed:', pass1);
  console.log('Admin hashed:', pass2);
  console.log('Admin hashed:', pass3);
  console.log('Admin hashed:', pass4);

}

run();
