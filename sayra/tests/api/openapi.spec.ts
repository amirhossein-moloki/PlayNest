import { describe, it, expect } from '@jest/globals';
import path from 'path';
import YAML from 'yamljs';
import fs from 'fs';

describe('OpenAPI Specification Validation Suite', () => {
  const specPaths = [
    path.join(__dirname, '../../src/docs/openapi.yaml'),
    path.join(__dirname, '../../openapi.yml'),
  ];

  specPaths.forEach((filePath) => {
    describe(`Spec file: ${path.basename(filePath)}`, () => {
      let doc: any;

      it('should exist and parse valid YAML syntax without errors', () => {
        expect(fs.existsSync(filePath)).toBe(true);
        expect(() => {
          doc = YAML.load(filePath);
        }).not.toThrow();
        expect(doc).toBeDefined();
      });

      it('should have valid OpenAPI 3.0 top-level structure', () => {
        expect(doc.openapi).toMatch(/^3\.0\./);
        expect(doc.info).toBeDefined();
        expect(doc.info.title).toBeDefined();
        expect(doc.info.version).toBeDefined();
        expect(doc.paths).toBeDefined();
        expect(doc.components).toBeDefined();
        expect(doc.components.schemas).toBeDefined();
      });

      it('should document /auth/me with GET and PATCH operations', () => {
        const mePath = doc.paths['/auth/me'];
        expect(mePath).toBeDefined();
        expect(mePath.get).toBeDefined();
        expect(mePath.patch).toBeDefined();
      });

      it('should document PATCH /auth/me with UpdateUserProfileInput request body and error responses', () => {
        const patchOp = doc.paths['/auth/me'].patch;
        expect(patchOp.tags).toContain('Auth');
        expect(patchOp.security).toEqual([{ bearerAuth: [] }]);

        // Request Body
        const reqSchema = patchOp.requestBody.content['application/json'].schema;
        expect(reqSchema.$ref).toBe('#/components/schemas/UpdateUserProfileInput');

        // Response 200
        const resp200Schema = patchOp.responses['200'].content['application/json'].schema;
        expect(resp200Schema.$ref).toBe('#/components/schemas/UserProfileResponse');

        // Error Responses
        expect(patchOp.responses['400']).toBeDefined();
        expect(patchOp.responses['401']).toBeDefined();
        expect(patchOp.responses['404']).toBeDefined();
        expect(patchOp.responses['409']).toBeDefined();
        expect(patchOp.responses['500']).toBeDefined();
      });

      it('should document GET /auth/me with UserProfileResponse including nullable username', () => {
        const getOp = doc.paths['/auth/me'].get;
        expect(getOp.tags).toContain('Auth');
        expect(getOp.security).toEqual([{ bearerAuth: [] }]);

        const resp200Schema = getOp.responses['200'].content['application/json'].schema;
        expect(resp200Schema.$ref).toBe('#/components/schemas/UserProfileResponse');

        // Check UserProfile schema definition
        const userProfile = doc.components.schemas.UserProfile;
        expect(userProfile).toBeDefined();
        expect(userProfile.properties.username).toBeDefined();
        expect(userProfile.properties.username.nullable).toBe(true);
        expect(userProfile.properties.fullName).toBeDefined();
        expect(userProfile.properties.firstName).toBeDefined();
        expect(userProfile.properties.lastName).toBeDefined();
      });

      it('should resolve every single $ref across the entire specification', () => {
        const refs: Array<{ ref: string; path: string }> = [];
        function findRefs(obj: any, currentPath = '') {
          if (!obj || typeof obj !== 'object') return;
          for (const [k, v] of Object.entries(obj)) {
            if (k === '$ref' && typeof v === 'string') {
              refs.push({ ref: v, path: currentPath });
            } else {
              findRefs(v, currentPath + '.' + k);
            }
          }
        }
        findRefs(doc);

        expect(refs.length).toBeGreaterThan(400);

        const brokenRefs: Array<{ ref: string; path: string }> = [];
        for (const { ref, path: refPath } of refs) {
          if (ref.startsWith('#/components/schemas/')) {
            const name = ref.replace('#/components/schemas/', '');
            if (!doc.components?.schemas?.[name]) {
              brokenRefs.push({ ref, path: refPath });
            }
          } else if (ref.startsWith('#/components/responses/')) {
            const name = ref.replace('#/components/responses/', '');
            if (!doc.components?.responses?.[name]) {
              brokenRefs.push({ ref, path: refPath });
            }
          } else if (ref.startsWith('#/components/parameters/')) {
            const name = ref.replace('#/components/parameters/', '');
            if (!doc.components?.parameters?.[name]) {
              brokenRefs.push({ ref, path: refPath });
            }
          } else {
            brokenRefs.push({ ref, path: refPath });
          }
        }

        expect(brokenRefs).toEqual([]);
      });
    });
  });
});
