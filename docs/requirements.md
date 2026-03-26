# Хэрэглэгчийн хүсэлт (User stories)
- Баримт бичиг үүсгэж, folder-р зохион байгуулах
- Олон хэрэглэгч нэгэн зэрэг засварлахад cursor харагдах, өөрчлөлт бодит цагт sync болох
- Rich text: heading, bold, italic, list, table, code block
- Баримтыг найзтайгаа хуваалцах — view-only эсвэл edit эрх
- Version history: өмнөх хувилбар руу буцах
- Баримтыг PDF-р export хийх

# Техникийн шаардлага & судалгааны сэдэв
- Архитектурын шийдэл
- CRDT яагаад collaborative editing-д хэрэгтэй вэ
- Yjs library: Y.Doc, awareness protocol
- Document state PostgreSQL-д persist хийх
- Cursor presence: position sync архитектур
- Performance судалгаа
- Yjs update binary encoding vs JSON
- Version snapshot хэзээ, хэр олон хадгалах
- PDF export server-side (Puppeteer)
- Deploy (үнэгүй tier)
- Yjs WS server + API → Fly.io
- PostgreSQL → Supabase free (500MB)
- React + TipTap → Vercel
- Docker Compose local dev
