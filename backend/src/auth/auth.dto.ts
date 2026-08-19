import { IsString, IsNotEmpty, IsEnum, MinLength, IsAlphanumeric } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @IsAlphanumeric()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['RECEPTIONIST', 'ADMIN'], { message: 'Role must be either RECEPTIONIST or ADMIN' })
  role: 'RECEPTIONIST' | 'ADMIN';
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
