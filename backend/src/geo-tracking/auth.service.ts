import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Employee, UserRole } from './schemas/employee.schema';
import { LoginDto, CreateEmployeeDto } from './dto/auth.dto';

export interface EmployeeResponse {
  companyId: string;
  employeeId: string;
  name: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Employee.name) private employeeModel: Model<Employee>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(createEmployeeDto: CreateEmployeeDto): Promise<{
    accessToken: string;
    employee: EmployeeResponse;
  }> {
    const companyId = this.configService.get<string>(
      'geoTracking.defaultCompanyId',
    );

    // employeeId is globally unique in this single-company deployment, so we
    // check by employeeId alone rather than scoping to companyId — older
    // records may predate the default-company assignment.
    const existingEmployee = await this.employeeModel.findOne({
      employeeId: createEmployeeDto.employeeId,
    });

    if (existingEmployee) {
      throw new ConflictException('Employee already exists');
    }

    const passwordHash = await bcrypt.hash(createEmployeeDto.password, 10);

    const employee = new this.employeeModel({
      ...createEmployeeDto,
      companyId,
      passwordHash,
      role: createEmployeeDto.role || UserRole.EMPLOYEE,
    });
    await employee.save();

    const payload = {
      employeeId: employee.employeeId,
      companyId: employee.companyId,
      role: employee.role,
    };

    const { passwordHash: _, ...employeeWithoutPassword } = employee.toObject();

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '7d',
      }),
      employee: {
        companyId: employeeWithoutPassword.companyId,
        employeeId: employeeWithoutPassword.employeeId,
        name: employeeWithoutPassword.name,
        role: employeeWithoutPassword.role,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    employee: EmployeeResponse;
  }> {
    // Look up by employeeId alone: this is a single-company deployment and
    // existing employees may have been created before defaultCompanyId
    // existed, so scoping the lookup to companyId would lock them out.
    const employee = await this.employeeModel.findOne({
      employeeId: loginDto.employeeId,
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      employee.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      employeeId: employee.employeeId,
      companyId: employee.companyId,
      role: employee.role,
    };

    const { passwordHash: _, ...employeeWithoutPassword } = employee.toObject();

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '7d',
      }),
      employee: {
        companyId: employeeWithoutPassword.companyId,
        employeeId: employeeWithoutPassword.employeeId,
        name: employeeWithoutPassword.name,
        role: employeeWithoutPassword.role,
      },
    };
  }
}
