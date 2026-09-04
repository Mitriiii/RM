# Emission factor data

This directory holds versioned emission-factor data files consumed by `loadFactorSetFromFile`
(see `../src/loader.ts`). It is currently **empty** — no real factor set has been added yet.

Do not add fictional, estimated, or "for now" numbers here. See CLAUDE.md's non-negotiables:
a missing factor must produce a `MissingFactorError`, never a guess. Fictional data used only
by tests lives under `../src/__fixtures__`, always under a `TEST_ONLY` source, and must never
be copied into this directory.

## Layout convention

```
data/<source>/<version>/factors.json
```

e.g. `data/glec/3.1/factors.json`, `data/eu-jrc/2024.1/factors.json`. Each file must validate
against `factorSetFileSchema` in `../src/schema.ts` — see that file for the exact shape.

## Official sources to populate this from

- **GLEC Framework** (Smart Freight Centre) — the industry-standard methodology for logistics
  emissions accounting; its published factor tables are the primary source for road-freight
  transport-operation-category emission intensities.
  https://www.smartfreightcentre.org/en/our-programs/global-logistics-emissions-council/glec-framework/
- **EU JRC / EEA default values** — the default emission factors referenced by EN ISO
  14083:2023 and CountEmissionsEU for members without primary or modelled data.
- **ISO 14083:2023 Annex default tables** — the standard's own default factors, used as the
  data-quality floor ("default" grade, the lowest of the three grades in CLAUDE.md's
  data-quality hierarchy).

## Before marking a factor set usable

1. Confirm the source document's publication date and version number match `id.version` and
   `id.effectiveDate` exactly. These must be traceable back to the source document, never
   assigned arbitrarily — an auditor will ask "which document, which edition."
2. Cross-check at least three factor values against the source document by hand.
3. Confirm the GWP set (`gwpSet`, e.g. `AR5-100` or `AR6-100`) matches what the source document
   used. Mixing GWP sets across a calculation produces a wrong number that looks right.
4. Have a second person — or the same person on a second read, days apart — repeat step 2
   independently.
5. Record the verification in the pull request or ADR that adds the file: which document,
   which page or table, who checked it, when.

Only after all of the above does a factor set get referenced by its exact
`(source, version, effectiveDate)` in application code, seed data, or a stored calculation.
