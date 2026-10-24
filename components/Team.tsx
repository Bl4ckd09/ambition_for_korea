import Image from 'next/image';

const team = [
  {
    name: 'Jinah Yoo',
    role: 'Clinical Psychologist',
    photo: '/team/jinah.jpg',
    blurb: 'Officially licensed Mental Health Clinical Psychologist (정신건강임상심리사) with 13 years of clinical experience.',
    badge: '정신건강임상심리사 · 13 years',
  },
  {
    name: 'Sun Hwang',
    role: 'AI Solution Engineer',
    photo: '/team/sun.jpg',
    blurb: 'Builds production agents and multimodal evals, and has won three hackathons.',
  },
  {
    name: '박성우',
    role: 'AI Engineer',
    photo: '/team/seongwoo.jpg',
    blurb: 'Builds RAG and multi-agent systems for financial AI and workflow automation.',
  },
  {
    name: 'Changhoon Lee',
    role: 'AI Research Engineer',
    photo: '/team/changhoon.jpg',
    blurb: 'Research engineer at TEN with a Yonsei University background.',
  },
];

export default function Team() {
  return (
    <ul className="team">
      {team.map((m) => (
        <li key={m.name} className={m.badge ? 'member featured' : 'member'}>
          <Image src={m.photo} alt={`Photo of ${m.name}`} width={260} height={260} />
          <div>
            <h2>{m.name}</h2>
            <p className="role">{m.role}</p>
            {m.badge && <span className="badge">{m.badge}</span>}
            <p className="blurb">{m.blurb}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
