import * as argon2 from 'argon2';

async function run() {
  const plainPass = '123456';
  const hash = await argon2.hash(plainPass); // tạo hash
  console.log('Hash:', hash);

  // Kiểm tra verify
  const isMatch = await argon2.verify(hash, plainPass);
  console.log('Match?', isMatch);
}

run();
