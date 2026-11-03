import * as CatalogRepo from './catalog.repo';
import {
  CreateDeviceCatalogInput,
  UpdateDeviceCatalogInput,
  ListDeviceCatalogQuery,
  CreateGameCatalogInput,
  UpdateGameCatalogInput,
  ListGameCatalogQuery,
} from './catalog.validator';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

// ==========================================
// Device Catalog Station Logic
// ==========================================

export async function createDevice(data: CreateDeviceCatalogInput) {
  return CatalogRepo.createDevice(data);
}

export async function getDeviceById(id: string) {
  const device = await CatalogRepo.findDeviceById(id);
  if (!device) {
    throw new AppError('Device catalog item not found', httpStatus.NOT_FOUND);
  }
  return device;
}

export async function getDevices(query: ListDeviceCatalogQuery) {
  return CatalogRepo.findDevices(query);
}

export async function updateDevice(id: string, data: UpdateDeviceCatalogInput) {
  await getDeviceById(id);
  return CatalogRepo.updateDevice(id, data);
}

export async function deleteDevice(id: string) {
  await getDeviceById(id);
  return CatalogRepo.deleteDevice(id);
}

// ==========================================
// Game Catalog Station Logic
// ==========================================

export async function createGame(data: CreateGameCatalogInput) {
  return CatalogRepo.createGame(data);
}

export async function getGameById(id: string) {
  const game = await CatalogRepo.findGameById(id);
  if (!game) {
    throw new AppError('Game catalog item not found', httpStatus.NOT_FOUND);
  }
  return game;
}

export async function getGames(query: ListGameCatalogQuery) {
  return CatalogRepo.findGames(query);
}

export async function updateGame(id: string, data: UpdateGameCatalogInput) {
  await getGameById(id);
  return CatalogRepo.updateGame(id, data);
}

export async function deleteGame(id: string) {
  await getGameById(id);
  return CatalogRepo.deleteGame(id);
}
