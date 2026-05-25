import { salonService } from './gamingCenter.station';
import { salonRepository } from './gamingCenter.repository';
import createHttpError from 'http-errors';

// Mock the repository
jest.mock('./gamingCenter.repository', () => ({
  salonRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  },
}));

describe('SalonService', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSalon', () => {
    it('should create a new gamingCenter if the slug is unique', async () => {
      const salonData = {
        name: 'Test GamingCenter',
        slug: 'test-gamingCenter',
        ownerId: 'owner-id-123',
      };
      const createdSalon = { ...salonData, id: 'gamingCenter-id-123', isActive: true };

      (salonRepository.findBySlug as jest.Mock).mockResolvedValue(null);
      (salonRepository.create as jest.Mock).mockResolvedValue(createdSalon);

      const result = await salonService.createSalon(salonData);

      expect(salonRepository.findBySlug).toHaveBeenCalledWith(salonData.slug);
      expect(salonRepository.create).toHaveBeenCalledWith(salonData);
      expect(result).toEqual(createdSalon);
    });

    it('should throw a 409 conflict error if the slug already exists', async () => {
      const salonData = {
        name: 'Test GamingCenter',
        slug: 'test-gamingCenter',
        ownerId: 'owner-id-123',
      };
      const existingSalon = {
        ...salonData,
        id: 'gamingCenter-id-456',
        isActive: true,
      };

      (salonRepository.findBySlug as jest.Mock).mockResolvedValue(
        existingSalon,
      );

      await expect(salonService.createSalon(salonData)).rejects.toThrow(
        createHttpError(409, 'A gamingCenter with this slug already exists'),
      );

      expect(salonRepository.findBySlug).toHaveBeenCalledWith(salonData.slug);
      expect(salonRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getSalonById', () => {
    it('should return a gamingCenter if it is found', async () => {
      const gamingCenterId = 'gamingCenter-id-123';
      const gamingCenter = {
        id: gamingCenterId,
        name: 'Test GamingCenter',
        slug: 'test-gamingCenter',
        ownerId: 'owner-id-123',
        isActive: true,
      };

      (salonRepository.findById as jest.Mock).mockResolvedValue(gamingCenter);

      const result = await salonService.getSalonById(gamingCenterId);

      expect(salonRepository.findById).toHaveBeenCalledWith(gamingCenterId);
      expect(result).toEqual(gamingCenter);
    });

    it('should throw a 404 not found error if the gamingCenter does not exist', async () => {
      const gamingCenterId = 'non-existent-id';
      (salonRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(salonService.getSalonById(gamingCenterId)).rejects.toThrow(
        createHttpError(404, 'GamingCenter not found'),
      );

      expect(salonRepository.findById).toHaveBeenCalledWith(gamingCenterId);
    });
  });

  describe('updateSalon', () => {
    const gamingCenterId = 'gamingCenter-id-123';
    const existingSalon = {
      id: gamingCenterId,
      name: 'Old Name',
      slug: 'old-slug',
      ownerId: 'owner-id-123',
      isActive: true,
    };
    const updateData = { name: 'New Name', slug: 'new-slug' };

    it('should update the gamingCenter successfully', async () => {
      const updatedSalon = { ...existingSalon, ...updateData };
      (salonRepository.findById as jest.Mock).mockResolvedValue(existingSalon);
      (salonRepository.findBySlug as jest.Mock).mockResolvedValue(null);
      (salonRepository.update as jest.Mock).mockResolvedValue(updatedSalon);

      const result = await salonService.updateSalon(gamingCenterId, updateData);

      expect(salonRepository.findById).toHaveBeenCalledWith(gamingCenterId);
      expect(salonRepository.findBySlug).toHaveBeenCalledWith(updateData.slug);
      expect(salonRepository.update).toHaveBeenCalledWith(gamingCenterId, updateData);
      expect(result).toEqual(updatedSalon);
    });

    it('should throw a 404 error if the gamingCenter to update is not found', async () => {
      (salonRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        salonService.updateSalon(gamingCenterId, updateData),
      ).rejects.toThrow(createHttpError(404, 'GamingCenter not found'));

      expect(salonRepository.findById).toHaveBeenCalledWith(gamingCenterId);
      expect(salonRepository.update).not.toHaveBeenCalled();
    });

    it('should throw a 409 error if the new slug already exists', async () => {
      const anotherSalon = {
        id: 'gamingCenter-id-456',
        name: 'Another GamingCenter',
        slug: 'new-slug',
      };
      (salonRepository.findById as jest.Mock).mockResolvedValue(existingSalon);
      (salonRepository.findBySlug as jest.Mock).mockResolvedValue(anotherSalon);

      await expect(
        salonService.updateSalon(gamingCenterId, updateData),
      ).rejects.toThrow(
        createHttpError(409, 'A gamingCenter with this slug already exists'),
      );

      expect(salonRepository.findById).toHaveBeenCalledWith(gamingCenterId);
      expect(salonRepository.findBySlug).toHaveBeenCalledWith(updateData.slug);
      expect(salonRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteSalon', () => {
    const gamingCenterId = 'gamingCenter-id-123';
    const existingSalon = {
      id: gamingCenterId,
      name: 'Test GamingCenter',
      slug: 'test-gamingCenter',
    };

    it('should soft delete the gamingCenter successfully', async () => {
      (salonRepository.findById as jest.Mock).mockResolvedValue(existingSalon);
      (salonRepository.softDelete as jest.Mock).mockResolvedValue({
        ...existingSalon,
        isActive: false,
      });

      await salonService.deleteSalon(gamingCenterId);

      expect(salonRepository.findById).toHaveBeenCalledWith(gamingCenterId);
      expect(salonRepository.softDelete).toHaveBeenCalledWith(gamingCenterId);
    });

    it('should throw a 404 error if the gamingCenter to delete is not found', async () => {
      (salonRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(salonService.deleteSalon(gamingCenterId)).rejects.toThrow(
        createHttpError(404, 'GamingCenter not found'),
      );

      expect(salonRepository.findById).toHaveBeenCalledWith(gamingCenterId);
      expect(salonRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('getAllSalons', () => {
    it('should call repository.findAll with query', async () => {
      const query = { page: 1, limit: 10 };
      const gamingCenters = {
        data: [{ id: '1', name: 'GamingCenter 1' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };

      (salonRepository.findAll as jest.Mock).mockResolvedValue(gamingCenters);

      const result = await salonService.getAllSalons(query as any);

      expect(salonRepository.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(gamingCenters);
    });
  });
});
