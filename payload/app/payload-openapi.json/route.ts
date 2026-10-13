import fs from 'fs'
import path from 'path'

export const GET = () => {
  try {
    let jsonPath = path.join(process.cwd(), 'src/docs/payload-openapi.json')
    if (!fs.existsSync(jsonPath)) {
      jsonPath = path.join(process.cwd(), 'payload/src/docs/payload-openapi.json')
    }
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8')
    return new Response(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Payload OpenAPI spec not found', details: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
