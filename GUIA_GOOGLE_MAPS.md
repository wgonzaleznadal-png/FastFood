# 🗺️ Guía de Integración: Google Maps API

## 📋 Requisitos Previos

1. **Cuenta de Google Cloud Platform**
2. **Tarjeta de crédito** (Google da $200 USD gratis al mes)
3. **Dominio verificado** (opcional pero recomendado)

---

## 🔑 Paso 1: Obtener API Key

### 1.1 Crear Proyecto en Google Cloud

1. Andá a: https://console.cloud.google.com/
2. Clickeá **"Crear proyecto"**
3. Nombre del proyecto: `GastroDash Maps`
4. Clickeá **"Crear"**

### 1.2 Habilitar APIs Necesarias

Necesitás habilitar estas 3 APIs:

1. **Maps JavaScript API** (para el mapa interactivo)
2. **Geocoding API** (para convertir direcciones en coordenadas)
3. **Places API** (para autocompletar direcciones)

**Cómo habilitarlas:**
- Andá a: https://console.cloud.google.com/apis/library
- Buscá cada API
- Clickeá **"Habilitar"**

### 1.3 Crear API Key

1. Andá a: https://console.cloud.google.com/apis/credentials
2. Clickeá **"Crear credenciales"** → **"Clave de API"**
3. Copiá la API Key (algo como: `AIzaSyC...`)

### 1.4 Restringir la API Key (IMPORTANTE)

**Para producción:**
1. Clickeá en la API Key que creaste
2. En **"Restricciones de aplicación"**:
   - Seleccioná **"Referentes HTTP (sitios web)"**
   - Agregá tus dominios:
     ```
     http://localhost:3000/*
     https://tu-dominio.com/*
     ```

3. En **"Restricciones de API"**:
   - Seleccioná **"Restringir clave"**
   - Marcá solo:
     - Maps JavaScript API
     - Geocoding API
     - Places API

4. Clickeá **"Guardar"**

---

## 💻 Paso 2: Configurar el Frontend

### 2.1 Instalar Dependencias

```bash
cd frontend
npm install @react-google-maps/api
```

### 2.2 Agregar API Key al `.env.local`

Creá o editá `/frontend/.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyC...tu-api-key-aqui
```

⚠️ **IMPORTANTE:** Nunca subas este archivo a Git. Ya está en `.gitignore`.

---

## 🛠️ Paso 3: Implementar el Mapa

### 3.1 Crear Componente de Mapa

Creá `/frontend/src/components/maps/DeliveryMap.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { Stack, TextInput, Button, Text } from "@mantine/core";
import { IconMapPin } from "@tabler/icons-react";

interface DeliveryMapProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void;
  initialAddress?: string;
}

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "8px",
};

const defaultCenter = {
  lat: -34.6037, // Buenos Aires
  lng: -58.3816,
};

export default function DeliveryMap({ onLocationSelect, initialAddress }: DeliveryMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState(initialAddress || "");
  const [searching, setSearching] = useState(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarker({ lat, lng });

      // Geocoding inverso: convertir coordenadas en dirección
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const formattedAddress = results[0].formatted_address;
          setAddress(formattedAddress);
          onLocationSelect(formattedAddress, lat, lng);
        }
      });
    }
  }, [onLocationSelect]);

  const handleSearchAddress = async () => {
    if (!address.trim()) return;
    
    setSearching(true);
    const geocoder = new google.maps.Geocoder();
    
    geocoder.geocode({ address }, (results, status) => {
      setSearching(false);
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        setMarker({ lat, lng });
        map?.panTo({ lat, lng });
        map?.setZoom(16);
        
        onLocationSelect(results[0].formatted_address, lat, lng);
      } else {
        alert("No se encontró la dirección. Intentá con otra.");
      }
    });
  };

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <TextInput
          label="Dirección de entrega"
          placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchAddress()}
          leftSection={<IconMapPin size={16} />}
        />
        <Button onClick={handleSearchAddress} loading={searching} fullWidth>
          Buscar en el mapa
        </Button>
      </Stack>

      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={marker || defaultCenter}
          zoom={marker ? 16 : 12}
          onLoad={onLoad}
          onClick={handleMapClick}
        >
          {marker && <Marker position={marker} />}
        </GoogleMap>
      </LoadScript>

      <Text size="xs" c="dimmed">
        💡 Clickeá en el mapa para marcar la ubicación exacta de entrega
      </Text>
    </Stack>
  );
}
```

### 3.2 Usar el Componente en Pedidos

Ejemplo en `/frontend/src/components/caja/KgOrdersModule.tsx`:

```tsx
import DeliveryMap from "@/components/maps/DeliveryMap";

// Dentro del formulario de nuevo pedido:
{isDelivery && (
  <DeliveryMap
    initialAddress={deliveryAddress}
    onLocationSelect={(address, lat, lng) => {
      setDeliveryAddress(address);
      setDeliveryLat(lat);
      setDeliveryLng(lng);
    }}
  />
)}
```

---

## 📊 Paso 4: Guardar Coordenadas en la DB

### 4.1 Actualizar Schema de Prisma

Editá `/backend/prisma/schema.prisma`:

```prisma
model KgOrder {
  // ... campos existentes ...
  deliveryAddress String?
  deliveryLat     Float?
  deliveryLng     Float?
  // ... resto de campos ...
}
```

### 4.2 Crear Migración

```bash
cd backend
npx prisma migrate dev --name add_delivery_coordinates
```

### 4.3 Actualizar Backend

Ya está implementado en:
- `PATCH /api/shifts/orders/:id/coords` (shifts.router.ts)
- `updateOrderCoords()` (shifts.service.ts)

---

## 🚀 Paso 5: Probar la Integración

1. **Reiniciá el frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Creá un pedido de delivery:**
   - Andá a `/dashboard/caja`
   - Clickeá "Nuevo Pedido" → "Delivery"
   - Deberías ver el mapa de Google Maps
   - Buscá una dirección o clickeá en el mapa

3. **Verificá que se guarden las coordenadas:**
   - Creá el pedido
   - Andá a la DB y verificá que `deliveryLat` y `deliveryLng` tengan valores

---

## 💰 Costos

Google Maps API es **GRATIS** hasta:
- **28,500 cargas de mapa** por mes
- **40,000 geocodificaciones** por mes

Después de eso, cuesta aprox **$7 USD por cada 1000 requests adicionales**.

Para un negocio gastronómico, **nunca vas a pagar** porque no vas a superar el límite gratuito.

---

## ✅ Checklist Final

- [ ] API Key creada y restringida
- [ ] APIs habilitadas (Maps JS, Geocoding, Places)
- [ ] `.env.local` configurado
- [ ] Componente `DeliveryMap` creado
- [ ] Schema de Prisma actualizado con coordenadas
- [ ] Migración ejecutada
- [ ] Mapa funcionando en el frontend

---

## 🆘 Problemas Comunes

**"This page can't load Google Maps correctly"**
→ Verificá que la API Key esté bien configurada en `.env.local`

**"RefererNotAllowedMapError"**
→ Agregá `http://localhost:3000/*` a las restricciones de referentes

**El mapa no carga**
→ Verificá que las 3 APIs estén habilitadas en Google Cloud Console

**"Geocoding API error"**
→ Verificá que tengas créditos disponibles en Google Cloud (los primeros $200 son gratis)
