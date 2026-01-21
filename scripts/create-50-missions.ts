import * as https from 'https';
import * as http from 'http';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjcwYzcxNTk1NTQwMzc0Yzc4ZmZhYiIsImVtYWlsIjoiYm9zc0BnbWFpbC5jb20iLCJyb2xlIjoicmVjcnVpdGVyIiwiaWF0IjoxNzY0MTY2NzY5LCJleHAiOjE3NjQ3NzE1Njl9.tJDTB-dmZ4_5bhscFZhXy4tuVrWqtQx-85yP-WlyKlA';

// Fonction utilitaire pour générer un nombre aléatoire entre min et max
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fonction pour choisir un élément aléatoire d'un tableau
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Fonction pour choisir plusieurs éléments aléatoires d'un tableau
function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 10 missions mobile-dev
const mobileMissions = [
  {
    title: 'Développeur Flutter Senior',
    description: 'Recherche d\'un développeur Flutter expérimenté pour développer et maintenir des applications mobiles cross-platform. Vous travaillerez sur des projets innovants avec une équipe dynamique.',
    skills: ['Flutter', 'Dart', 'Firebase', 'REST API', 'State Management']
  },
  {
    title: 'Développeur React Native',
    description: 'Mission pour un développeur React Native passionné par le mobile. Vous serez responsable du développement de nouvelles fonctionnalités et de l\'optimisation des performances.',
    skills: ['React Native', 'JavaScript', 'TypeScript', 'Redux', 'React Navigation', 'Jest']
  },
  {
    title: 'Ingénieur Android Kotlin',
    description: 'Recherche d\'un ingénieur Android spécialisé en Kotlin pour développer des applications natives performantes. Expérience avec les architectures modernes requise.',
    skills: ['Kotlin', 'Android SDK', 'Jetpack Compose', 'Coroutines', 'Room Database', 'Retrofit']
  },
  {
    title: 'Ingénieur iOS Swift',
    description: 'Mission pour un développeur iOS expérimenté en Swift. Vous travaillerez sur des applications iOS natives avec SwiftUI et les dernières technologies Apple.',
    skills: ['Swift', 'SwiftUI', 'UIKit', 'Core Data', 'Combine', 'Alamofire']
  },
  {
    title: 'Optimisation UI/UX Mobile',
    description: 'Mission d\'optimisation de l\'interface utilisateur et de l\'expérience utilisateur pour applications mobiles. Amélioration de la fluidité et de l\'ergonomie.',
    skills: ['UI/UX Design', 'Figma', 'Prototyping', 'User Testing', 'Accessibility', 'Design Systems']
  },
  {
    title: 'Amélioration Performance Mobile',
    description: 'Optimisation des performances d\'applications mobiles existantes. Réduction des temps de chargement, optimisation mémoire et amélioration de la réactivité.',
    skills: ['Performance Optimization', 'Profiling', 'Memory Management', 'Network Optimization', 'Caching']
  },
  {
    title: 'Intégration API Mobile',
    description: 'Développement et intégration d\'APIs REST pour applications mobiles. Connexion avec services backend, gestion de l\'authentification et synchronisation de données.',
    skills: ['REST API', 'GraphQL', 'OAuth', 'JWT', 'WebSocket', 'Error Handling']
  },
  {
    title: 'Développeur Mobile Full-Stack',
    description: 'Mission full-stack pour un développeur mobile capable de travailler sur le frontend mobile et le backend. Stack complète mobile + API.',
    skills: ['React Native', 'Node.js', 'MongoDB', 'Express', 'TypeScript', 'Docker']
  },
  {
    title: 'Correction Bugs Mobile',
    description: 'Mission de maintenance et correction de bugs sur applications mobiles existantes. Analyse, diagnostic et résolution de problèmes techniques.',
    skills: ['Debugging', 'Testing', 'Crash Analysis', 'Logging', 'Error Tracking', 'Code Review']
  },
  {
    title: 'QA/Test Mobile',
    description: 'Mission de test et assurance qualité pour applications mobiles. Tests manuels et automatisés, rédaction de plans de test et rapports de bugs.',
    skills: ['Mobile Testing', 'Appium', 'Jest', 'Detox', 'Test Automation', 'Bug Reporting']
  }
];

// Domaines pour les 40 autres missions
const domainTemplates = [
  {
    domain: 'Power BI / Data Analytics',
    titles: [
      'Analyste Power BI Senior',
      'Développeur Dashboards Power BI',
      'Consultant Data Analytics',
      'Spécialiste Business Intelligence'
    ],
    descriptions: [
      'Création et maintenance de dashboards Power BI pour la visualisation de données business. Transformation de données complexes en insights actionnables.',
      'Développement de solutions BI avec Power BI. Modélisation de données, création de rapports interactifs et formation des utilisateurs.',
      'Mission d\'analyse de données et création de rapports analytiques. Utilisation de Power BI, SQL et outils de data visualization.',
      'Conception et développement de solutions Business Intelligence. Optimisation des requêtes et amélioration des performances des rapports.'
    ],
    skills: ['Power BI', 'DAX', 'SQL', 'Excel', 'Data Modeling', 'ETL']
  },
  {
    domain: 'DevOps / Cloud',
    titles: [
      'Ingénieur DevOps AWS',
      'Spécialiste CI/CD',
      'Architecte Cloud Azure',
      'Ingénieur Infrastructure as Code'
    ],
    descriptions: [
      'Mise en place et maintenance de pipelines CI/CD, gestion de l\'infrastructure cloud AWS. Automatisation des déploiements et monitoring.',
      'Configuration et optimisation de pipelines CI/CD avec Jenkins, GitLab CI ou GitHub Actions. Automatisation des tests et déploiements.',
      'Architecture et déploiement de solutions cloud sur Azure. Optimisation des coûts et amélioration de la sécurité.',
      'Développement d\'infrastructure as code avec Terraform ou CloudFormation. Gestion de configurations et automatisation.'
    ],
    skills: ['Docker', 'Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Linux']
  },
  {
    domain: 'Video Editing / Motion Design',
    titles: [
      'Monteur Vidéo Professionnel',
      'Motion Designer',
      'Éditeur Vidéo After Effects',
      'Créateur de Contenu Vidéo'
    ],
    descriptions: [
      'Montage vidéo professionnel pour projets marketing et communication. Création de vidéos promotionnelles et tutoriels.',
      'Création d\'animations motion design pour vidéos et présentations. Maîtrise d\'After Effects et des outils de design.',
      'Édition vidéo avancée avec After Effects et Premiere Pro. Création d\'effets visuels et animations complexes.',
      'Production de contenu vidéo pour réseaux sociaux et sites web. Montage, colorisation et post-production.'
    ],
    skills: ['Premiere Pro', 'After Effects', 'Final Cut Pro', 'DaVinci Resolve', 'Motion Graphics', 'Color Grading']
  },
  {
    domain: 'UX/UI',
    titles: [
      'Designer UX/UI',
      'Designer Interface Utilisateur',
      'UX Researcher',
      'Designer Produit Digital'
    ],
    descriptions: [
      'Conception d\'interfaces utilisateur modernes et intuitives. Recherche utilisateur, wireframing, prototypage et design system.',
      'Création de designs d\'interface pour applications web et mobiles. Collaboration avec les développeurs pour l\'implémentation.',
      'Recherche utilisateur et analyse de l\'expérience utilisateur. Tests utilisateurs, personas et amélioration de l\'UX.',
      'Design de produits digitaux de A à Z. De la recherche à la conception, en passant par le prototypage et les tests.'
    ],
    skills: ['Figma', 'Adobe XD', 'Sketch', 'User Research', 'Prototyping', 'Design Systems']
  },
  {
    domain: 'Web Development',
    titles: [
      'Développeur Full Stack Node.js',
      'Développeur React Senior',
      'Développeur Angular',
      'Développeur Laravel',
      'Développeur Vue.js'
    ],
    descriptions: [
      'Développement full stack avec Node.js et React. Création d\'APIs REST, développement frontend et intégration de services tiers.',
      'Développement d\'applications web avec React. Optimisation des performances, gestion d\'état et intégration d\'APIs.',
      'Développement d\'applications enterprise avec Angular. Architecture modulaire, services et composants réutilisables.',
      'Développement backend avec Laravel. Création d\'APIs, gestion de base de données et intégration de fonctionnalités complexes.',
      'Développement frontend avec Vue.js. Création de composants réutilisables et applications SPA performantes.'
    ],
    skills: ['Node.js', 'React', 'Angular', 'Laravel', 'Vue.js', 'TypeScript', 'Express', 'MongoDB', 'PostgreSQL']
  },
  {
    domain: 'Cybersecurity',
    titles: [
      'Analyste Cybersécurité',
      'Pentester',
      'Spécialiste Sécurité Cloud',
      'Consultant Sécurité Informatique'
    ],
    descriptions: [
      'Analyse de vulnérabilités et mise en place de mesures de sécurité. Audit de sécurité et recommandations d\'amélioration.',
      'Tests d\'intrusion et évaluation de la sécurité des systèmes. Identification de vulnérabilités et rapports détaillés.',
      'Sécurisation d\'infrastructures cloud. Configuration de firewalls, gestion des accès et monitoring de sécurité.',
      'Consultation en sécurité informatique. Évaluation des risques, mise en place de politiques de sécurité et formation.'
    ],
    skills: ['Penetration Testing', 'OWASP', 'Network Security', 'Cloud Security', 'SIEM', 'Encryption']
  },
  {
    domain: 'Backend Engineering',
    titles: [
      'Développeur Backend Node.js',
      'Ingénieur Backend Python',
      'Développeur Backend Go',
      'Architecte Backend'
    ],
    descriptions: [
      'Développement d\'APIs REST et GraphQL avec Node.js. Optimisation des performances, gestion de base de données et microservices.',
      'Développement backend avec Python (Django/FastAPI). Création d\'APIs robustes, traitement de données et intégrations.',
      'Développement de services backend performants avec Go. Concurrence, microservices et systèmes distribués.',
      'Architecture et développement de systèmes backend scalables. Design de APIs, optimisation et best practices.'
    ],
    skills: ['Node.js', 'Python', 'Go', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Microservices']
  },
  {
    domain: 'Frontend Engineering',
    titles: [
      'Développeur Frontend React',
      'Développeur Frontend Vue.js',
      'Ingénieur Frontend TypeScript',
      'Spécialiste Frontend Performance'
    ],
    descriptions: [
      'Développement d\'interfaces utilisateur avec React. Optimisation des performances, accessibilité et responsive design.',
      'Création d\'applications frontend avec Vue.js. Composants réutilisables, gestion d\'état et intégration d\'APIs.',
      'Développement frontend avec TypeScript. Architecture modulaire, tests unitaires et intégration continue.',
      'Optimisation des performances frontend. Réduction des temps de chargement, code splitting et lazy loading.'
    ],
    skills: ['React', 'Vue.js', 'TypeScript', 'Webpack', 'Jest', 'CSS', 'HTML5']
  },
  {
    domain: 'QA Testing',
    titles: [
      'Testeur QA Automatisation',
      'Ingénieur QA',
      'Spécialiste Tests E2E',
      'Testeur Performance'
    ],
    descriptions: [
      'Automatisation des tests avec Selenium, Cypress ou Playwright. Création de frameworks de test et maintenance.',
      'Assurance qualité logicielle. Tests manuels et automatisés, rédaction de plans de test et rapports.',
      'Tests end-to-end pour applications web et mobiles. Scénarios de test complexes et intégration CI/CD.',
      'Tests de performance et charge. Optimisation des applications, profiling et recommandations d\'amélioration.'
    ],
    skills: ['Selenium', 'Cypress', 'Jest', 'Test Automation', 'API Testing', 'Performance Testing']
  },
  {
    domain: 'AI / ML',
    titles: [
      'Ingénieur Machine Learning',
      'Data Scientist',
      'Développeur IA',
      'Spécialiste NLP'
    ],
    descriptions: [
      'Développement de modèles de machine learning. Préparation de données, entraînement de modèles et déploiement.',
      'Analyse de données et création de modèles prédictifs. Utilisation de Python, pandas, scikit-learn et TensorFlow.',
      'Intégration de solutions d\'intelligence artificielle. Développement de chatbots, recommandation systems et automation.',
      'Traitement du langage naturel (NLP). Analyse de texte, sentiment analysis et génération de contenu.'
    ],
    skills: ['Python', 'TensorFlow', 'PyTorch', 'scikit-learn', 'NLP', 'Data Science', 'Pandas']
  }
];

// Fonction pour créer une mission
async function createMission(missionData: {
  title: string;
  description: string;
  duration: string;
  budget: number;
  skills: string[];
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/missions`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const postData = JSON.stringify(missionData);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${TOKEN}`
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 201) {
          console.log(`✅ Mission créée: ${missionData.title}`);
          resolve();
        } else {
          console.error(`❌ Erreur ${res.statusCode} pour: ${missionData.title}`);
          console.error(`Réponse: ${data}`);
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Erreur réseau pour: ${missionData.title}`);
      console.error(error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Fonction principale
async function main() {
  console.log('🚀 Démarrage de la création de 50 missions...\n');

  const missions: Array<{
    title: string;
    description: string;
    duration: string;
    budget: number;
    skills: string[];
  }> = [];

  // 1. Créer 10 missions mobile-dev
  console.log('📱 Création de 10 missions mobile-dev...');
  for (const mobileMission of mobileMissions) {
    missions.push({
      ...mobileMission,
      duration: `${randomInt(1, 12)} mois`,
      budget: randomInt(1000, 80000)
    });
  }

  // 2. Créer 40 missions mélangées
  console.log('🌐 Création de 40 missions mélangées...');
  for (let i = 0; i < 40; i++) {
    const domain = randomChoice(domainTemplates);
    const title = randomChoice(domain.titles);
    const description = randomChoice(domain.descriptions);
    
    // Sélectionner 3-6 compétences aléatoires
    const skillCount = randomInt(3, 6);
    const selectedSkills = randomChoices(domain.skills, skillCount);

    missions.push({
      title,
      description,
      duration: `${randomInt(1, 12)} mois`,
      budget: randomInt(1000, 80000),
      skills: selectedSkills
    });
  }

  // Mélanger toutes les missions
  const shuffledMissions = missions.sort(() => 0.5 - Math.random());

  // Créer les missions avec un délai pour éviter de surcharger l'API
  console.log('\n📤 Envoi des requêtes POST...\n');
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < shuffledMissions.length; i++) {
    try {
      await createMission(shuffledMissions[i]);
      successCount++;
      
      // Petit délai entre les requêtes (100ms)
      if (i < shuffledMissions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      errorCount++;
      console.error(`Erreur lors de la création de la mission ${i + 1}:`, error);
    }
  }

  console.log(`\n✨ Terminé! ${successCount} missions créées avec succès, ${errorCount} erreurs.`);
}

// Exécuter le script
main().catch((error) => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});

