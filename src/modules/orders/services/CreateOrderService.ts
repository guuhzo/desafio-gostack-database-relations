import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);

    if (!customerExist) {
      throw new AppError('This customer not exist');
    }

    const existentProduct = await this.productsRepository.findAllById(products);

    if (!existentProduct.length) {
      throw new AppError('Could not find any product with the given ids');
    }

    const existentProductIds = existentProduct.map(product => product.id);

    const inexistentProductIds = products.filter(
      product => !existentProductIds.includes(product.id),
    );

    if (inexistentProductIds.length) {
      throw new AppError(
        `Could not find product ${inexistentProductIds[0].id}`,
      );
    }

    const noQuantityProducts = products.filter(
      product =>
        existentProduct.filter(eProduct => eProduct.id === product.id)[0]
          .quantity < product.quantity,
    );

    if (noQuantityProducts.length) {
      throw new AppError(
        `The quantity ${noQuantityProducts[0].quantity} is not available for ${noQuantityProducts[0].id}`,
      );
    }

    const orderProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProduct.filter(eProduct => eProduct.id === product.id)[0]
        .price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: orderProducts,
    });

    const newProductQuantity = products.map(product => ({
      id: product.id,
      quantity:
        existentProduct.filter(eProduct => eProduct.id === product.id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(newProductQuantity);

    return order;
  }
}

export default CreateOrderService;
