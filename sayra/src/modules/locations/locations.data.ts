export interface Province {
  id: string;
  name: string;
  slug: string;
}

export interface City {
  id: string;
  provinceId: string;
  name: string;
  slug: string;
}

export const IRAN_PROVINCES: Province[] = [
  { id: 'province_tehran', name: 'تهران', slug: 'tehran' },
  { id: 'province_isfahan', name: 'اصفهان', slug: 'isfahan' },
  { id: 'province_fars', name: 'فارس', slug: 'fars' },
  { id: 'province_khorasan_razavi', name: 'خراسان رضوی', slug: 'khorasan-razavi' },
  { id: 'province_east_azerbaijan', name: 'آذربایجان شرقی', slug: 'east-azerbaijan' },
  { id: 'province_west_azerbaijan', name: 'آذربایجان غربی', slug: 'west-azerbaijan' },
  { id: 'province_alborz', name: 'البرز', slug: 'alborz' },
  { id: 'province_mazandaran', name: 'مازندران', slug: 'mazandaran' },
  { id: 'province_gilan', name: 'گیلان', slug: 'gilan' },
  { id: 'province_khuzestan', name: 'خوزستان', slug: 'khuzestan' },
  { id: 'province_kermanshah', name: 'کرمانشاه', slug: 'kermanshah' },
  { id: 'province_qom', name: 'قم', slug: 'qom' },
  { id: 'province_yazd', name: 'یزد', slug: 'yazd' },
  { id: 'province_kerman', name: 'کرمان', slug: 'kerman' },
  { id: 'province_hormozgan', name: 'هرمزگان', slug: 'hormozgan' },
];

export const IRAN_CITIES: City[] = [
  // تهران
  { id: 'city_tehran', provinceId: 'province_tehran', name: 'تهران', slug: 'tehran' },
  { id: 'city_rey', provinceId: 'province_tehran', name: 'ری', slug: 'rey' },
  { id: 'city_shemiranat', provinceId: 'province_tehran', name: 'شمیرانات', slug: 'shemiranat' },
  { id: 'city_eslamshahr', provinceId: 'province_tehran', name: 'اسلامشهر', slug: 'eslamshahr' },
  { id: 'city_shahriar', provinceId: 'province_tehran', name: 'شهریار', slug: 'shahriar' },
  // اصفهان
  { id: 'city_isfahan', provinceId: 'province_isfahan', name: 'اصفهان', slug: 'isfahan' },
  { id: 'city_kashan', provinceId: 'province_isfahan', name: 'کاشان', slug: 'kashan' },
  { id: 'city_najafabad', provinceId: 'province_isfahan', name: 'نجف‌آباد', slug: 'najafabad' },
  { id: 'city_shahinshahr', provinceId: 'province_isfahan', name: 'شاهین‌شهر', slug: 'shahinshahr' },
  // فارس
  { id: 'city_shiraz', provinceId: 'province_fars', name: 'شیراز', slug: 'shiraz' },
  { id: 'city_marvdasht', provinceId: 'province_fars', name: 'مرودشت', slug: 'marvdasht' },
  { id: 'city_jahrom', provinceId: 'province_fars', name: 'جهرم', slug: 'jahrom' },
  // خراسان رضوی
  { id: 'city_mashhad', provinceId: 'province_khorasan_razavi', name: 'مشهد', slug: 'mashhad' },
  { id: 'city_neyshabur', provinceId: 'province_khorasan_razavi', name: 'نیشابور', slug: 'neyshabur' },
  { id: 'city_sabzevar', provinceId: 'province_khorasan_razavi', name: 'سبزوار', slug: 'sabzevar' },
  // آذربایجان شرقی
  { id: 'city_tabriz', provinceId: 'province_east_azerbaijan', name: 'تبریز', slug: 'tabriz' },
  { id: 'city_maragheh', provinceId: 'province_east_azerbaijan', name: 'مراغه', slug: 'maragheh' },
  // آذربایجان غربی
  { id: 'city_urmia', provinceId: 'province_west_azerbaijan', name: 'ارومیه', slug: 'urmia' },
  { id: 'city_khoy', provinceId: 'province_west_azerbaijan', name: 'خوی', slug: 'khoy' },
  // البرز
  { id: 'city_karaj', provinceId: 'province_alborz', name: 'کرج', slug: 'karaj' },
  { id: 'city_fardis', provinceId: 'province_alborz', name: 'فردیس', slug: 'fardis' },
  // مازندران
  { id: 'city_sari', provinceId: 'province_mazandaran', name: 'ساری', slug: 'sari' },
  { id: 'city_babol', provinceId: 'province_mazandaran', name: 'بابل', slug: 'babol' },
  { id: 'city_amol', provinceId: 'province_mazandaran', name: 'آمل', slug: 'amol' },
  // گیلان
  { id: 'city_rasht', provinceId: 'province_gilan', name: 'رشت', slug: 'rasht' },
  { id: 'city_anzali', provinceId: 'province_gilan', name: 'بندر انزلی', slug: 'anzali' },
  // خوزستان
  { id: 'city_ahvaz', provinceId: 'province_khuzestan', name: 'اهواز', slug: 'ahvaz' },
  { id: 'city_abadan', provinceId: 'province_khuzestan', name: 'آبادان', slug: 'abadan' },
  // کرمانشاه
  { id: 'city_kermanshah', provinceId: 'province_kermanshah', name: 'کرمانشاه', slug: 'kermanshah' },
  // قم
  { id: 'city_qom', provinceId: 'province_qom', name: 'قم', slug: 'qom' },
  // یزد
  { id: 'city_yazd', provinceId: 'province_yazd', name: 'یزد', slug: 'yazd' },
  // کرمان
  { id: 'city_kerman', provinceId: 'province_kerman', name: 'کرمان', slug: 'kerman' },
  // هرمزگان
  { id: 'city_bandar_abbas', provinceId: 'province_hormozgan', name: 'بندرعباس', slug: 'bandar-abbas' },
];

export const LocationsService = {
  getProvinces(): Province[] {
    return IRAN_PROVINCES;
  },

  getCitiesByProvinceId(provinceId: string): City[] {
    return IRAN_CITIES.filter((c) => c.provinceId === provinceId);
  },

  findProvinceById(id: string): Province | undefined {
    return IRAN_PROVINCES.find((p) => p.id === id);
  },

  findCityById(id: string): City | undefined {
    return IRAN_CITIES.find((c) => c.id === id);
  },
};
