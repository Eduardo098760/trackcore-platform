# Logos - Favicon & Icons

Coloque aqui os favicons e ícones do aplicativo.

## Arquivos esperados:

- `rastrear-favicon.ico` - Favicon padrão (16x16, 32x32, 48x48)
- `rastrear-favicon.png` - Favicon em PNG (opcional)
- `apple-touch-icon.png` - Ícone para iOS (180x180)
- `android-chrome-icon.png` - Ícone para Android (192x192)

## Configuração

O caminho é referenciado em `src/config/tenants.ts`:

```typescript
faviconUrl: "/logos/rastrear-favicon.ico"
```

## Gerador de Favicons (recomendado):

Use [Favicon Generator](https://realfavicongenerator.net/) para gerar todos os formatos necessários:

1. Faça upload de sua logo
2. Customize para diferentes plataformas
3. Baixe o arquivo ZIP
4. Extraia os arquivos para esta pasta

## Recomendações:

- **Tamanho mínimo:** 512x512px ou maior
- **Formato:** PNG com transparência
- **Favicon.ico:** Inclua múltiplas resoluções (16x16, 32x32, 48x48)
- **Apple:** 180x180px com espaço em branco
- **Android:** 192x192px com espaço em branco
