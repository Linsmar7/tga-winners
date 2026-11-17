import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRankingAndStats, buildVoterDetails } from '../server/scoring.js';

describe('computeRankingAndStats', () => {
  const categories = [
    { id: 1, name: 'Game of the Year', display_order: 1 },
    { id: 2, name: 'Best Direction', display_order: 2 },
    { id: 3, name: 'Best Indie', display_order: 3 },
  ];

  const nominees = [
    { id: 10, category_id: 1, name: 'Game A', image_url: null, is_winner: true },
    { id: 11, category_id: 1, name: 'Game B', image_url: null, is_winner: false },
    { id: 20, category_id: 2, name: 'Dir A', image_url: null, is_winner: false },
    { id: 21, category_id: 2, name: 'Dir B', image_url: null, is_winner: true },
    { id: 30, category_id: 3, name: 'Indie A', image_url: null, is_winner: true },
    { id: 31, category_id: 3, name: 'Indie B', image_url: null, is_winner: false },
  ];

  it('aplica +5 por Vai Ganhar e +1 bônus zebra apenas quando diferente do palpite principal', () => {
    const voters = [
      { id: 1, nickname: 'Alice' },
      { id: 2, nickname: 'Bob' },
      { id: 3, nickname: 'Carol' },
    ];

    const votes = [
      // Alice: duplicou Game A (5 pts, sem +1), acertou Dir B apenas em Quero (+1 pt zebra), errou Indie
      { voter_id: 1, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 10 },
      { voter_id: 1, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 21 },
      { voter_id: 1, category_id: 3, will_win_nominee_id: 31, want_win_nominee_id: 31 },
      // Bob: acertou Game A (5 pts) e errou resto, mas votou 2x em perdedores no Quero
      { voter_id: 2, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 11 },
      { voter_id: 2, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 20 },
      // Carol: acertou Game A (5) e Indie A (5), total 10 pts
      { voter_id: 3, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 11 },
      { voter_id: 3, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 20 },
      { voter_id: 3, category_id: 3, will_win_nominee_id: 30, want_win_nominee_id: 31 },
    ];

    const result = computeRankingAndStats({ categories, nominees, voters, votes });

    assert.equal(result.ranking[0].nickname, 'Carol');
    assert.equal(result.ranking[0].total_points, 10);
    assert.equal(result.ranking[0].will_win_hits, 2);

    assert.equal(result.ranking[1].nickname, 'Alice');
    assert.equal(result.ranking[1].total_points, 6); // 5 + 1 (anti-exploit verified)
    assert.equal(result.ranking[1].will_win_hits, 1);
    assert.equal(result.ranking[1].want_win_bonus_hits, 1);

    assert.equal(result.ranking[2].nickname, 'Bob');
    assert.equal(result.ranking[2].total_points, 5);

    // Barbada: GOTY 3/3 = 100%
    assert.equal(result.stats.barbada.category_name, 'Game of the Year');
    assert.equal(result.stats.barbada.percentage, 100);

    // Zebra: Best Direction 0/3 = 0%
    assert.equal(result.stats.zebra.category_name, 'Best Direction');
    assert.equal(result.stats.zebra.percentage, 0);

    // Queridinho: Game B (11) e Dir A (20) e Indie B (31) têm 2 votos cada -> 2 votos
    assert.equal(result.stats.queridinho.votes_count, 2);

    // Mais iludido: Carol perdeu 3 Quero que Ganhe (11, 20, 31)
    assert.equal(result.stats.mais_iludido.nickname, 'Carol');
    assert.equal(result.stats.mais_iludido.lost_want_win_count, 3);
  });

  it('usa maior número de acertos em Vai Ganhar como desempate', () => {
    const voters = [
      { id: 1, nickname: 'ZebraMaster' }, // 0 vai ganhar + 5 não dá 5, então 1 vai ganhar (5) + 0 = 5
      { id: 2, nickname: 'MainPicker' },
    ];
    // Give ZebraMaster 1 will_win (5) + 0 = 5 vs MainPicker... let's test 6 pts vs 6 pts?
    // 1 will_win + 1 bonus = 6 pts (will_win_hits=1) vs cannot get 6 with 2 will_win (10).
    // Test 5 pts (1 will_win) vs 5 pts? Let's test 1 will_win (5) vs 5 bonus (5) using 6 categories!
    const cats = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `Cat ${i + 1}`,
      display_order: i + 1,
    }));
    const noms = cats.flatMap((c) => [
      { id: c.id * 10 + 1, category_id: c.id, name: `Win ${c.id}`, is_winner: true },
      { id: c.id * 10 + 2, category_id: c.id, name: `Lose ${c.id}`, is_winner: false },
    ]);
    const tieVotes = [
      // Voter 1: 5 bônus zebra (5 pts, 0 will_win_hits)
      ...[1, 2, 3, 4, 5].map((cid) => ({
        voter_id: 1,
        category_id: cid,
        will_win_nominee_id: cid * 10 + 2,
        want_win_nominee_id: cid * 10 + 1,
      })),
      // Voter 2: 1 will_win (5 pts, 1 will_win_hit)
      {
        voter_id: 2,
        category_id: 1,
        will_win_nominee_id: 11,
        want_win_nominee_id: 11,
      },
    ];

    const res = computeRankingAndStats({
      categories: cats,
      nominees: noms,
      voters,
      votes: tieVotes,
    });
    assert.equal(res.ranking[0].nickname, 'MainPicker');
    assert.equal(res.ranking[0].total_points, 5);
    assert.equal(res.ranking[1].nickname, 'ZebraMaster');
    assert.equal(res.ranking[1].total_points, 5);
  });

  it('monta detalhes do participante corretamente', () => {
    const details = buildVoterDetails({
      voter: { id: 1, nickname: 'Linsmar' },
      categories,
      nominees,
      votes: [
        { voter_id: 1, category_id: 1, will_win_nominee_id: 10, want_win_nominee_id: 10 },
        { voter_id: 1, category_id: 2, will_win_nominee_id: 20, want_win_nominee_id: 21 },
      ],
    });
    assert.equal(details.voter.total_points, 6);
    assert.equal(details.categories[0].points, 5);
    assert.equal(details.categories[0].upset_bonus, false);
    assert.equal(details.categories[1].points, 1);
    assert.equal(details.categories[1].upset_bonus, true);
  });
});
