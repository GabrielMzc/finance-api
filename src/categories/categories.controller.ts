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
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Category, CategoryType } from './entities/category.entity';

@ApiTags('categories')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova categoria' })
  @ApiResponse({
    status: 201,
    description: 'Categoria criada com sucesso',
    type: Category,
  })
  create(
    @Request() req,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.create(
      Number(req.user.id),
      createCategoryDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as categorias do usuário' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CategoryType,
    description: 'Filtrar por tipo de categoria',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de categorias retornada',
    type: [Category],
  })
  findAll(
    @Request() req,
    @Query('type') type?: CategoryType,
  ): Promise<Category[]> {
    return this.categoriesService.findAll(Number(req.user.id), type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar uma categoria específica' })
  @ApiResponse({
    status: 200,
    description: 'Categoria encontrada',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  findOne(@Param('id') id: string, @Request() req): Promise<Category> {
    return this.categoriesService.findOne(+id, Number(req.user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma categoria' })
  @ApiResponse({
    status: 200,
    description: 'Categoria atualizada',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(
      +id,
      Number(req.user.id),
      updateCategoryDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover uma categoria' })
  @ApiResponse({ status: 204, description: 'Categoria removida' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  @ApiResponse({ status: 403, description: 'Categoria possui transações' })
  remove(@Param('id') id: string, @Request() req): Promise<void> {
    return this.categoriesService.remove(+id, Number(req.user.id));
  }
}
