import React from 'react';
import { ShieldCheck } from 'lucide-react';

// Iniciales a partir del nombre (máx 2 letras).
const getInitials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// Estilo del anillo y la chapa de posición según el puesto (oro/plata/bronce).
const medalStyle = (position) => {
  switch (position) {
    case 1: return { ring: 'border-gold shadow-[0_0_10px_var(--color-gold-glow)]', badge: 'bg-gold text-black', label: 'text-gold' };
    case 2: return { ring: 'border-gray-300', badge: 'bg-gray-300 text-black', label: 'text-gray-300' };
    case 3: return { ring: 'border-amber-600', badge: 'bg-amber-600 text-white', label: 'text-amber-500' };
    default: return { ring: 'border-emerald-500/50', badge: 'bg-emerald-primary text-white', label: 'text-emerald-primary' };
  }
};

// Avatar persistente del usuario logueado: iniciales del nombre + chapa con su
// posición en el ranking. Pensado para el header (siempre visible). Si el usuario
// no participa en el ranking (admin/invitado) muestra el rol en lugar de la posición.
export default function UserRankBadge({ name, role, position = null, points = null, compact = false }) {
  const initials = getInitials(name);
  const m = medalStyle(position);
  const hasRank = position != null;

  return (
    <div className="flex items-center gap-2.5">
      <div className="text-right leading-tight">
        <span className="text-xs text-gray-100 font-bold block">{name}</span>
        {hasRank ? (
          <span className={`text-[10px] font-bold flex items-center justify-end gap-1 ${m.label}`}>
            Posición #{position}{!compact && points != null ? ` · ${points} pts` : ''}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400 capitalize flex items-center justify-end gap-1">
            {role === 'admin' && <ShieldCheck size={10} className="text-emerald-primary" />}
            {role}
          </span>
        )}
      </div>

      <div className="relative shrink-0" title={hasRank ? `${name} — Posición #${position}` : name}>
        <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-700/40 border-2 ${m.ring} flex items-center justify-center text-xs font-black text-white`}>
          {initials}
        </div>
        {hasRank && (
          <span className={`absolute -bottom-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full ${m.badge} flex items-center justify-center text-[10px] font-black border-2 border-soccer-card`}>
            {position}
          </span>
        )}
      </div>
    </div>
  );
}
