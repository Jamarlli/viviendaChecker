# 01 · Extracción del anuncio (Idealista)

Convierte la página de un anuncio de Idealista en un `Anuncio`.

## Modelo
```ts
Anuncio {
  portal: 'idealista'; id: string; url: string
  precio?: number
  tipo?: 'piso' | 'atico' | 'duplex' | 'estudio' | 'casa' | 'otro'
  obraNueva: boolean
  direccion?: { via?: string; numero?: string }
  municipio?: string; provincia?: string
  coords?: { lat: number; lon: number; aproximada: boolean }
  planta?: string            // normalizada: 'bajo' | '1' | '2'…
  m2Construidos?: number; m2Utiles?: number
  anio?: number
  descripcion: string
  mencionaTrastero: boolean; mencionaGaraje: boolean
}
```

## Criterios
- [ ] URL `idealista.com/inmueble/{id}/` → se extrae; otras URLs → `null`.
- [ ] Extrae cada campo presente; los ausentes quedan `undefined`, sin fallar.
- [ ] Parsea "90 m² construidos, 75 m² útiles", "Planta 3ª exterior", "Bajo", "Construido en 1975".
- [ ] Marca `coords.aproximada` cuando el portal indica ubicación aproximada.
- [ ] Cada caso se prueba con un HTML real guardado en `fixtures/idealista/`.

## Dudas
- Dónde están coords y dirección en el HTML actual. Se resuelve con fixtures reales (issue spike).
