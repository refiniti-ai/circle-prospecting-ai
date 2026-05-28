# Brokerage logo images (homepage carousel)

## Quick setup (8 logos from chat)

From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/copy-brokerage-logos.ps1
```

Or drag these files into this folder manually:

| File | Brand |
|------|--------|
| `remax.png` | RE/MAX |
| `coldwell-banker.png` | Coldwell Banker |
| `homeservices-america.png` | HomeServices of America |
| `berkshire-hathaway.png` | Berkshire Hathaway HomeServices |
| `exp-realty.png` | eXp Realty |
| `anywhere.png` | Anywhere |
| `weichert.png` | Weichert |
| `sothebys.png` | Sotheby's International Realty |

Then: `npm run deploy:hosting`

---

Drop client-provided logo files here. Recommended:

- **Format:** `.webp` or `.png` (transparent background)
- **Height:** 40–72px at display size (export at 2× for retina, e.g. 80–144px tall)
- **Max width:** ~280px per logo
- **Naming:** use the filenames below exactly (or update `BROKERAGE_LOGOS` in `src/components/marketing/marketingData.ts`)

| File | Brand |
|------|--------|
| `exit-realty.webp` | EXIT Realty Corp. International |
| `homeservices-america.webp` | HomeServices of America |
| `keller-williams.webp` | Keller Williams |
| `long-foster.webp` | Long & Foster Real Estate |
| `remax.webp` | RE/MAX |
| `berkshire-hathaway.webp` | Berkshire Hathaway HomeServices (optional) |
| `exp-realty.webp` | eXp Realty (optional) |

After adding files, run `npm run build` and redeploy hosting.
