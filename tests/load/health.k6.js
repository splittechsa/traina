import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL || 'http://localhost:3000'}/v1/health`);
  check(response, {
    'liveness is 200': (result) => result.status === 200,
  });
  sleep(1);
}
