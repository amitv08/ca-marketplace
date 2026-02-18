import request from 'supertest';
import app from '/app/src/server';

async function main() {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'New Client',
      email: 'newclient@test.com',
      password: 'Zr8!cPd5$wNf3kX',
      role: 'CLIENT',
      phoneNumber: '+919876543220',
    });
  console.log('STATUS:', response.status);
  console.log('BODY:', JSON.stringify(response.body));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
