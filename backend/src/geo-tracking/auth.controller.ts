import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService, EmployeeResponse } from './auth.service';
import { LoginDto, CreateEmployeeDto } from './dto/auth.dto';
import { JwtAuthGuard, AuthenticatedUser } from './guards/jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() createEmployeeDto: CreateEmployeeDto): Promise<{
    accessToken: string;
    employee: EmployeeResponse;
  }> {
    return this.authService.register(createEmployeeDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<{
    accessToken: string;
    employee: EmployeeResponse;
  }> {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async getMe(@Request() req: { user: AuthenticatedUser }): Promise<{ user: AuthenticatedUser }> {
    return { user: req.user };
  }
}
