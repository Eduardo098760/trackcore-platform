# Layout Patterns & UI Standards

## Princípios Gerais

- **Dark Mode Support**: Todos os componentes devem suportar `dark:` prefixes
- **Responsive**: Mobile-first, com breakpoints: sm, md, lg, xl
- **Spacing**: Usar escala padrão Tailwind (px, 0.5, 1, 2, 3, 4, 6, 8, etc)
- **Typography**: Usar componentes semantic HTML + Tailwind classes
- **Consistência**: Seguir paleta do shadcn/ui

---

## Directory/Page Layout

### Estrutura padrão de página dashboard

```tsx
export default function PageName() {
  return (
    <div className="min-h-screen bg-background">
      {/* 1. HEADER com PageHeader component */}
      <PageHeader 
        title="Título da Página"
        description="Descrição breve"
        action={<Button>Ação Principal</Button>}
      />

      {/* 2. FILTERS/SEARCH (se aplicável) */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex gap-4">
          <Input placeholder="Buscar..." />
          <Select>/* ... */</Select>
        </div>
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="p-6 space-y-6">
        {/* Grid/List de items */}
        {/* or Form/Details */}
        {/* or Charts/Stats */}
      </div>
    </div>
  );
}
```

---

## Card Patterns

### Basic Card
```tsx
<Card className="hover:shadow-md transition-shadow">
  <CardHeader>
    <CardTitle className="text-lg font-semibold">Título</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">Conteúdo</p>
  </CardContent>
</Card>
```

### Card with Badge/Status
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>Título</CardTitle>
    <Badge variant={status === 'online' ? 'default' : 'secondary'}>
      {status}
    </Badge>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* conteúdo */}
  </CardContent>
</Card>
```

### Card with Actions
```tsx
<Card>
  <CardHeader className="flex flex-row items-start justify-between">
    <div>
      <CardTitle>Título</CardTitle>
      <p className="text-sm text-muted-foreground mt-1">Subtítulo</p>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm"><MoreVertical /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Editar</DropdownMenuItem>
        <DropdownMenuItem>Deletar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </CardHeader>
</Card>
```

---

## Form Patterns

### Simple Form
```tsx
<form onSubmit={handleSubmit} className="space-y-6">
  <div className="space-y-2">
    <Label htmlFor="name">Nome</Label>
    <Input 
      id="name"
      placeholder="Digite o nome"
      value={formData.name}
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="role">Perfil</Label>
    <Select value={formData.role} onValueChange={(role) => setFormData({ ...formData, role })}>
      <SelectTrigger id="role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Administrador</SelectItem>
        <SelectItem value="user">Usuário</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div className="flex gap-2">
    <Button type="submit">Salvar</Button>
    <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
  </div>
</form>
```

### Form in Dialog
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Criar Novo</DialogTitle>
      <DialogDescription>Preencha os dados abaixo</DialogDescription>
    </DialogHeader>
    <form className="space-y-4">
      {/* campos */}
    </form>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleCreate}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Criar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Table Patterns

### Basic Table
```tsx
<div className="rounded-md border border-border overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead>Nome</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Ações</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map(item => (
        <TableRow key={item.id} className="hover:bg-muted/50">
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>
            <Badge>{item.status}</Badge>
          </TableCell>
          <TableCell className="text-right space-x-2">
            <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
              <Edit className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

## Grid Patterns

### Two-Column Grid (Dashboard)
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <StatsCard title="Total" value="1,234" icon={Car} />
  <StatsCard title="Online" value="856" icon={Wifi} />
  <StatsCard title="Offline" value="378" icon={WifiOff} />
</div>
```

### Responsive List
```tsx
<div className="space-y-4">
  <div className="hidden md:grid md:grid-cols-5 gap-4 text-sm font-medium text-muted-foreground pb-4 border-b">
    <div>Nome</div>
    <div>Email</div>
    <div>Perfil</div>
    <div>Data</div>
    <div>Ações</div>
  </div>

  {items.map(item => (
    <div key={item.id} className="flex flex-col md:grid md:grid-cols-5 gap-4 p-4 border rounded-lg hover:bg-muted/50">
      <div className="font-medium">{item.name}</div>
      <div className="text-sm text-muted-foreground">{item.email}</div>
      <div><Badge>{item.role}</Badge></div>
      <div className="text-sm">{formatDate(item.createdAt)}</div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost"><Edit /></Button>
      </div>
    </div>
  ))}
</div>
```

---

## Alert & Status Patterns

### Status Indicators
```tsx
// Online/Offline
const statusColor = device.status === 'online' 
  ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
  : 'bg-gray-500/20 text-gray-700 dark:text-gray-400';

<span className={cn('px-2 py-1 rounded-full text-xs font-semibold', statusColor)}>
  {device.status}
</span>

// Or use Badge
<Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
  {device.status}
</Badge>
```

### Info/Warning/Error States
```tsx
// Info
<div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-700 dark:text-blue-400">
  ℹ️ Informação importante
</div>

// Warning
<div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
  ⚠️ Atenção: algo precisa ser verificado
</div>

// Error
<div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-700 dark:text-red-400">
  ❌ Erro: algo deu errado
</div>
```

---

## Loading States

### Skeleton Loading
```tsx
{isLoading ? (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-lg" />
    ))}
  </div>
) : (
  /* conteúdo normal */
)}
```

### Loading Button
```tsx
<Button disabled={isLoading} onClick={handleClick}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isLoading ? 'Carregando...' : 'Salvar'}
</Button>
```

### Empty State
```tsx
{items.length === 0 && (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="rounded-full bg-muted p-3 mb-4">
      <Car className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="font-semibold text-lg mb-2">Nenhum dispositivo</h3>
    <p className="text-sm text-muted-foreground mb-6">Comece adicionando um novo dispositivo</p>
    <Button onClick={() => setIsOpen(true)}>
      <Plus className="h-4 w-4 mr-2" />
      Novo Dispositivo
    </Button>
  </div>
)}
```

---

## Navigation Patterns

### Navbar/Header
```tsx
<header className="sticky top-0 z-50 bg-background border-b border-border">
  <div className="flex items-center justify-between px-6 py-4">
    <h1 className="text-2xl font-bold">Logo</h1>
    <nav className="flex gap-4">
      <Button variant="ghost">Dashboard</Button>
      <Button variant="ghost">Configurações</Button>
    </nav>
    <UserMenu />
  </div>
</header>
```

### Sidebar Navigation
```tsx
<aside className="w-64 border-r border-border bg-background">
  <nav className="p-4 space-y-2">
    {items.map(item => (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          pathname === item.href
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted text-muted-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Link>
    ))}
  </nav>
</aside>
```

---

## Color & Design Tokens (Tailwind)

### Primary Colors
- Primary: `bg-primary text-primary-foreground` (azul)
- Secondary: `bg-secondary text-secondary-foreground` (cinza)
- Accent: `bg-accent text-accent-foreground` (destacado)

### Status Colors
- Success: `bg-green-500/20 text-green-700`
- Warning: `bg-amber-500/20 text-amber-700`
- Error: `bg-red-500/20 text-red-700`
- Info: `bg-blue-500/20 text-blue-700`

### Neutral
- Background: `bg-background` (fundo padrão)
- Foreground: `text-foreground` (texto padrão)
- Muted: `bg-muted text-muted-foreground` (desabilitado)
- Border: `border-border` (bordas)

---

## Dark Mode Support

Todos os componentes devem ter suporte a dark mode:

```tsx
<div className="
  bg-white dark:bg-slate-900
  text-gray-900 dark:text-gray-100
  border-gray-200 dark:border-slate-700
">
  Conteúdo com dark mode
</div>
```

Usar `dark:` prefix no Tailwind para variantes dark mode.

---

## Spacing & Sizing

### Standard Spacing
```
0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24, 28, 32, ...
```

### Common Patterns
```tsx
// Padding
p-4           // all sides
px-6 py-4     // x and y
p-4 md:p-6    // responsive

// Margin
gap-4         // for flex/grid
space-y-4     // for vertical stacking

// Sizing
w-full        // 100%
max-w-2xl     // max-width
h-10          // height
```

---

**Sempre verificar `src/components/ui/` para exemplos de componentes já estilizados.**
