# 05 · Alertas en el texto

Detecta en la descripción situaciones que el comprador debe conocer. Solo reglas, sin LLM.

## Alertas
| Tipo | Ejemplos de patrón |
|---|---|
| Ocupado | ocupado, okupa, sin posesión |
| Subasta / cesión de remate | subasta, cesión de remate, adjudicación |
| Nuda propiedad | nuda propiedad, usufructo |
| Alquilado | alquilado, con inquilino, rentabilidad actual |
| Protección oficial | VPO, VPP, protección oficial, precio limitado |
| Sin visitas | no se puede visitar, sin visitas, solo inversores |
| Proindiviso / herencia | proindiviso, pendiente de herencia |

## Criterios
- [ ] Normaliza (minúsculas, sin tildes) antes de buscar.
- [ ] Ignora negaciones cercanas: "no está ocupado", "libre de ocupantes", "sin inquilinos".
- [ ] Cada alerta cita la frase que la activa.
- [ ] Corpus de pruebas con positivos y negativos reales por tipo.
