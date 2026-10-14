import { rmSync } from 'node:fs'
import { GRABACIONES, GRABAR } from './extension'

// Al grabar se parte de cero: no quedan respuestas huérfanas.
export default function preparar() {
  if (GRABAR) rmSync(GRABACIONES, { recursive: true, force: true })
}
