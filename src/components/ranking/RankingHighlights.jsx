import React from 'react';
import {
  Brain,
  CloudSun,
  Eye,
  Flame,
  Heart,
  Sparkles,
  Swords,
  Target,
  Users2,
  Zap,
} from 'lucide-react';
import NomineeImage from '../NomineeImage';

export default function RankingHighlights({ stats = {} }) {
  const hasFunAwards = Boolean(
    stats.oracle ||
      stats.dreamer ||
      stats.pragmatic ||
      stats.twins ||
      stats.rivals ||
      (stats.unique_visionaries && stats.unique_visionaries.length > 0)
  );

  const showRivals =
    stats.rivals &&
    (!stats.twins ||
      stats.rivals.voter_a_id !== stats.twins.voter_a_id ||
      stats.rivals.voter_b_id !== stats.twins.voter_b_id);

  return (
    <>
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Target className="h-4 w-4 text-emerald-400" />}
          label="Barbada do Ano"
          title={stats.barbada ? stats.barbada.winner_name : 'Aguardando apuração'}
          subtitle={
            stats.barbada
              ? `${stats.barbada.category_name} · ${stats.barbada.percentage}% acertaram (${stats.barbada.hits}/${stats.barbada.total_votes})`
              : 'Maior % de acertos em Vai Ganhar'
          }
          imageUrl={stats.barbada?.winner_image_url}
        />

        <StatCard
          icon={<Zap className="h-4 w-4 text-amber-400" />}
          label="Zebra do Ano"
          title={stats.zebra ? stats.zebra.winner_name : 'Aguardando apuração'}
          subtitle={
            stats.zebra
              ? `${stats.zebra.category_name} · ${stats.zebra.percentage}% acertaram (${stats.zebra.hits}/${stats.zebra.total_votes})`
              : 'Menor % de acertos em Vai Ganhar'
          }
          imageUrl={stats.zebra?.winner_image_url}
        />

        <StatCard
          icon={<Heart className="h-4 w-4 text-rose-400" />}
          label="Queridinho da Galera"
          title={stats.queridinho ? stats.queridinho.nominee_name : 'Sem votos ainda'}
          subtitle={
            stats.queridinho
              ? `${stats.queridinho.category_name} · ${stats.queridinho.votes_count} votos em Quero`
              : 'Mais votado em Quero que Ganhe'
          }
          imageUrl={stats.queridinho?.image_url}
        />

        <StatCard
          icon={<Flame className="h-4 w-4 text-orange-400" />}
          label="Mais Iludido"
          title={stats.mais_iludido ? stats.mais_iludido.nickname : 'Aguardando apuração'}
          subtitle={
            stats.mais_iludido
              ? `${stats.mais_iludido.lost_want_win_count} escolhas "Quero" derrotadas`
              : 'Mais votos em "Quero" que perderam'
          }
        />
      </section>

      {hasFunAwards && (
        <section className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.oracle && (
            <MiniAwardCard
              icon={<Eye className="h-3.5 w-3.5 text-purple-400" />}
              label="🔮 Oráculo / Mãe Dináh"
              value={stats.oracle.nickname}
              detail={`${stats.oracle.best_streak} seguidos · ${stats.oracle.accuracy_pct}% precisão`}
            />
          )}
          {stats.dreamer && (
            <MiniAwardCard
              icon={<CloudSun className="h-3.5 w-3.5 text-sky-400" />}
              label="💭 Sonhador"
              value={stats.dreamer.nickname}
              detail={`${stats.dreamer.count}× Vai Ganhar = Quero`}
            />
          )}
          {stats.pragmatic && (
            <MiniAwardCard
              icon={<Brain className="h-3.5 w-3.5 text-emerald-400" />}
              label="🧠 Pragmático"
              value={stats.pragmatic.nickname}
              detail={`${stats.pragmatic.count}× separou razão e emoção`}
            />
          )}
          {stats.twins && (
            <MiniAwardCard
              icon={<Users2 className="h-3.5 w-3.5 text-amber-400" />}
              label="👯 Gêmeos de Palpite"
              value={`${stats.twins.voter_a_nickname} & ${stats.twins.voter_b_nickname}`}
              detail={`${stats.twins.percentage}% iguais (${stats.twins.same_count}/${stats.twins.shared_count})`}
            />
          )}
          {showRivals && (
            <MiniAwardCard
              icon={<Swords className="h-3.5 w-3.5 text-rose-400" />}
              label="⚔️ Rivais"
              value={`${stats.rivals.voter_a_nickname} × ${stats.rivals.voter_b_nickname}`}
              detail={`Só ${stats.rivals.percentage}% de concordância`}
            />
          )}
          {stats.unique_visionaries && stats.unique_visionaries.length > 0 && (
            <MiniAwardCard
              icon={<Sparkles className="h-3.5 w-3.5 text-amber-300" />}
              label="🦄 Único Visionário"
              value={stats.unique_visionaries[0].nickname}
              detail={`Cravou sozinho: ${stats.unique_visionaries[0].winner_name} (${stats.unique_visionaries[0].category_name})`}
            />
          )}
        </section>
      )}
    </>
  );
}

function StatCard({ icon, label, title, subtitle, imageUrl }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      {imageUrl !== undefined && (
        <NomineeImage
          src={imageUrl}
          alt={title}
          className="h-14 w-14 rounded-xl"
          iconClassName="h-5 w-5"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {icon}
          <span>{label}</span>
        </div>
        <p className="mt-1 truncate text-base font-bold text-zinc-100">{title}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

function MiniAwardCard({ icon, label, value, detail }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-bold text-zinc-100">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-zinc-400">{detail}</p>
    </div>
  );
}
