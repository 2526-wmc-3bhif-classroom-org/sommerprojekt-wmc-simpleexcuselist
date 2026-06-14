
import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Set it in your .env file.`,
    );
  }
  return value;
}

export const env = {
  jwtSecret: required('JWT_SECRET'),
  untisSchool: required('UNTIS_SCHOOL'),
  untisHost: required('UNTIS_BASE_URL'),
  port: Number(process.env.PORT) || 3000,
};
