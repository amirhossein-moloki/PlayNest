import { Request, Response, NextFunction } from 'express';
import * as customerService from './customers.station';
import { CreateCustomerInput, UpdateCustomerInput } from './customers.types';

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId } = req.params;
    const { search, page, limit } = req.query;

    const result = await customerService.listCustomers(gamingCenterId, {
      search: search as string,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.ok(result);
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, customerId } = req.params;
    const customer = await customerService.getCustomerDetail(gamingCenterId, customerId);

    res.ok(customer);
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId } = req.params;
    const input: CreateCustomerInput = req.body;

    const customer = await customerService.createCustomer(gamingCenterId, input);

    res.created(customer);
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, customerId } = req.params;
    const input: UpdateCustomerInput = req.body;

    const customer = await customerService.updateCustomer(gamingCenterId, customerId, input);

    res.ok(customer);
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, customerId } = req.params;
    await customerService.deleteCustomer(gamingCenterId, customerId);
    res.noContent();
  } catch (error) {
    next(error);
  }
}
