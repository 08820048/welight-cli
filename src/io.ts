import fs from 'node:fs/promises'
import process from 'node:process'

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin)
    chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString(`utf8`)
}

/** 读取输入文件；传 "-" 时从 stdin 读取 */
export async function readInput(file: string): Promise<string> {
  return file === `-` ? readStdin() : fs.readFile(file, `utf8`)
}
