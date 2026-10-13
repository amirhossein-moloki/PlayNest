import fs from 'fs'
import path from 'path'

export const GET = () => {
  try {
    let yamlPath = path.join(process.cwd(), 'src/docs/payload-openapi.yaml')
    if (!fs.existsSync(yamlPath)) {
      yamlPath = path.join(process.cwd(), 'payload/src/docs/payload-openapi.yaml')
    }
    const yamlContent = fs.readFileSync(yamlPath, 'utf-8')
    return new Response(yamlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
      },
    })
  } catch (err: any) {
    return new Response(`Error loading Payload OpenAPI spec: ${err.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
