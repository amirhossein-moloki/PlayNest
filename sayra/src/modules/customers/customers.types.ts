export interface CreateCustomerInput {
  phone: string;
  fullName?: string;
  displayName?: string;
  note?: string;
}

export interface UpdateCustomerInput {
  displayName?: string;
  note?: string;
}

export interface CustomerFilters {
  search?: string;
  page?: number;
  limit?: number;
}
