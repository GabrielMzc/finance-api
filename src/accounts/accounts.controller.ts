import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova conta' })
  @ApiResponse({ status: 201, description: 'Conta criada com sucesso' })
  create(@Request() req, @Body() createAccountDto: CreateAccountDto) {
    return this.accountsService.create(Number(req.user.id), createAccountDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as contas do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de contas retornada' })
  findAll(@Request() req) {
    return this.accountsService.findAll(Number(req.user.id));
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obter resumo das contas do usuário' })
  @ApiResponse({ status: 200, description: 'Resumo retornado' })
  getSummary(@Request() req) {
    return this.accountsService.getSummary(Number(req.user.id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar uma conta específica' })
  @ApiResponse({ status: 200, description: 'Conta encontrada' })
  @ApiResponse({ status: 404, description: 'Conta não encontrada' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.accountsService.findOne(+id, Number(req.user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma conta' })
  @ApiResponse({ status: 200, description: 'Conta atualizada' })
  @ApiResponse({ status: 404, description: 'Conta não encontrada' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateAccountDto: UpdateAccountDto,
  ) {
    return this.accountsService.update(
      +id,
      Number(req.user.id),
      updateAccountDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover uma conta' })
  @ApiResponse({ status: 204, description: 'Conta removida' })
  @ApiResponse({ status: 404, description: 'Conta não encontrada' })
  @ApiResponse({ status: 403, description: 'Conta possui transações' })
  remove(@Param('id') id: string, @Request() req) {
    return this.accountsService.remove(+id, Number(req.user.id));
  }
}
