// data/job-postings.js
// Static dataset of real-ish job postings sourced from public job boards.
// These are representative roles with realistic skill requirements.
// Phase 5: The matching engine scores user skills against this corpus
// instead of letting Gemini invent fictional roles.

export const JOB_POSTINGS = [
    {
        id: 'sr-fe-meta',
        title: 'Senior Frontend Engineer',
        company: 'Meta',
        location: 'Menlo Park, CA (Hybrid)',
        salary_range: '$180k–$260k',
        required_skills: ['React', 'JavaScript', 'TypeScript', 'CSS', 'Performance Optimization'],
        nice_to_have: ['GraphQL', 'React Native', 'Accessibility', 'Design Systems'],
        level: 'senior',
        category: 'frontend'
    },
    {
        id: 'fe-eng-stripe',
        title: 'Frontend Engineer',
        company: 'Stripe',
        location: 'San Francisco, CA (Remote OK)',
        salary_range: '$160k–$230k',
        required_skills: ['React', 'TypeScript', 'CSS', 'HTML', 'API Integration'],
        nice_to_have: ['Payments', 'Accessibility', 'Animations', 'Storybook'],
        level: 'mid',
        category: 'frontend'
    },
    {
        id: 'fs-eng-vercel',
        title: 'Full-Stack Engineer',
        company: 'Vercel',
        location: 'Remote (Global)',
        salary_range: '$150k–$220k',
        required_skills: ['Next.js', 'React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        nice_to_have: ['Edge Functions', 'Turborepo', 'CI/CD', 'Serverless'],
        level: 'mid',
        category: 'fullstack'
    },
    {
        id: 'be-eng-google',
        title: 'Backend Software Engineer',
        company: 'Google',
        location: 'Mountain View, CA (Hybrid)',
        salary_range: '$170k–$280k',
        required_skills: ['Go', 'Python', 'Distributed Systems', 'gRPC', 'Cloud'],
        nice_to_have: ['Kubernetes', 'Machine Learning', 'Protocol Buffers', 'BigQuery'],
        level: 'senior',
        category: 'backend'
    },
    {
        id: 'sre-netflix',
        title: 'Site Reliability Engineer',
        company: 'Netflix',
        location: 'Los Gatos, CA (Hybrid)',
        salary_range: '$200k–$340k',
        required_skills: ['Linux', 'Python', 'AWS', 'Terraform', 'Monitoring'],
        nice_to_have: ['Java', 'Chaos Engineering', 'Kafka', 'CI/CD'],
        level: 'senior',
        category: 'infrastructure'
    },
    {
        id: 'be-eng-shopify',
        title: 'Backend Developer',
        company: 'Shopify',
        location: 'Remote (Americas)',
        salary_range: '$130k–$190k',
        required_skills: ['Ruby', 'Rails', 'PostgreSQL', 'GraphQL', 'REST API'],
        nice_to_have: ['React', 'TypeScript', 'Redis', 'Docker'],
        level: 'mid',
        category: 'backend'
    },
    {
        id: 'ml-eng-openai',
        title: 'Machine Learning Engineer',
        company: 'OpenAI',
        location: 'San Francisco, CA',
        salary_range: '$250k–$450k',
        required_skills: ['Python', 'PyTorch', 'Machine Learning', 'Distributed Training', 'Mathematics'],
        nice_to_have: ['CUDA', 'Rust', 'LLM Fine-tuning', 'RLHF'],
        level: 'senior',
        category: 'ml'
    },
    {
        id: 'data-eng-databricks',
        title: 'Data Engineer',
        company: 'Databricks',
        location: 'Remote (US)',
        salary_range: '$150k–$220k',
        required_skills: ['Python', 'SQL', 'Spark', 'Data Pipelines', 'Cloud'],
        nice_to_have: ['Scala', 'Kafka', 'dbt', 'Airflow'],
        level: 'mid',
        category: 'data'
    },
    {
        id: 'ios-eng-apple',
        title: 'iOS Software Engineer',
        company: 'Apple',
        location: 'Cupertino, CA',
        salary_range: '$170k–$280k',
        required_skills: ['Swift', 'UIKit', 'SwiftUI', 'Core Data', 'Xcode'],
        nice_to_have: ['Objective-C', 'Metal', 'ARKit', 'Accessibility'],
        level: 'senior',
        category: 'mobile'
    },
    {
        id: 'android-eng-spotify',
        title: 'Android Engineer',
        company: 'Spotify',
        location: 'Stockholm, SE (Remote EU)',
        salary_range: '€65k–€95k',
        required_skills: ['Kotlin', 'Android SDK', 'Jetpack Compose', 'Coroutines', 'REST API'],
        nice_to_have: ['ExoPlayer', 'Dagger/Hilt', 'CI/CD', 'A/B Testing'],
        level: 'mid',
        category: 'mobile'
    },
    {
        id: 'devops-eng-aws',
        title: 'DevOps Engineer',
        company: 'Amazon Web Services',
        location: 'Seattle, WA (Hybrid)',
        salary_range: '$140k–$210k',
        required_skills: ['AWS', 'Terraform', 'Docker', 'Kubernetes', 'CI/CD'],
        nice_to_have: ['Python', 'Go', 'CloudFormation', 'Monitoring'],
        level: 'mid',
        category: 'infrastructure'
    },
    {
        id: 'platform-eng-datadog',
        title: 'Platform Engineer',
        company: 'Datadog',
        location: 'New York, NY (Hybrid)',
        salary_range: '$160k–$240k',
        required_skills: ['Go', 'Kubernetes', 'Linux', 'Distributed Systems', 'Observability'],
        nice_to_have: ['Rust', 'eBPF', 'Prometheus', 'Service Mesh'],
        level: 'senior',
        category: 'infrastructure'
    },
    {
        id: 'staff-eng-github',
        title: 'Staff Engineer',
        company: 'GitHub',
        location: 'Remote (US)',
        salary_range: '$220k–$340k',
        required_skills: ['Ruby', 'Go', 'System Design', 'Distributed Systems', 'Mentorship'],
        nice_to_have: ['TypeScript', 'React', 'PostgreSQL', 'Architecture'],
        level: 'staff',
        category: 'fullstack'
    },
    {
        id: 'security-eng-cloudflare',
        title: 'Security Engineer',
        company: 'Cloudflare',
        location: 'Remote (Global)',
        salary_range: '$150k–$230k',
        required_skills: ['Network Security', 'Go', 'Rust', 'Linux', 'Cryptography'],
        nice_to_have: ['DDoS Mitigation', 'WAF', 'Wireshark', 'Reverse Engineering'],
        level: 'senior',
        category: 'security'
    },
    {
        id: 'fe-eng-figma',
        title: 'Frontend Engineer, Editor',
        company: 'Figma',
        location: 'San Francisco, CA (Hybrid)',
        salary_range: '$160k–$250k',
        required_skills: ['TypeScript', 'WebGL', 'Canvas API', 'Performance', 'C++/WASM'],
        nice_to_have: ['Rust', 'Collaborative Editing', 'CRDTs', 'Graphics Programming'],
        level: 'senior',
        category: 'frontend'
    },
    {
        id: 'fs-eng-supabase',
        title: 'Full-Stack Developer',
        company: 'Supabase',
        location: 'Remote (Global)',
        salary_range: '$130k–$180k',
        required_skills: ['TypeScript', 'React', 'PostgreSQL', 'Node.js', 'REST API'],
        nice_to_have: ['Elixir', 'Realtime Subscriptions', 'Edge Functions', 'Docker'],
        level: 'mid',
        category: 'fullstack'
    },
    {
        id: 'rust-eng-1password',
        title: 'Rust Engineer',
        company: '1Password',
        location: 'Remote (US/Canada)',
        salary_range: '$140k–$200k',
        required_skills: ['Rust', 'Systems Programming', 'Cryptography', 'Cross-platform', 'Security'],
        nice_to_have: ['Swift', 'Kotlin', 'WebAssembly', 'CI/CD'],
        level: 'mid',
        category: 'systems'
    },
    {
        id: 'ai-eng-anthropic',
        title: 'AI Research Engineer',
        company: 'Anthropic',
        location: 'San Francisco, CA',
        salary_range: '$280k–$500k',
        required_skills: ['Python', 'PyTorch', 'Transformers', 'Mathematics', 'Distributed Training'],
        nice_to_have: ['RLHF', 'Safety Research', 'JAX', 'C++'],
        level: 'senior',
        category: 'ml'
    },
    {
        id: 'react-native-discord',
        title: 'React Native Engineer',
        company: 'Discord',
        location: 'San Francisco, CA (Remote OK)',
        salary_range: '$150k–$220k',
        required_skills: ['React Native', 'TypeScript', 'JavaScript', 'Mobile Development', 'React'],
        nice_to_have: ['Native Modules', 'Performance Profiling', 'Animations', 'Hermes'],
        level: 'mid',
        category: 'mobile'
    },
    {
        id: 'be-eng-linear',
        title: 'Backend Engineer',
        company: 'Linear',
        location: 'Remote (Global)',
        salary_range: '$140k–$200k',
        required_skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'GraphQL', 'System Design'],
        nice_to_have: ['Redis', 'Real-time Sync', 'Prisma', 'Performance'],
        level: 'mid',
        category: 'backend'
    },
    {
        id: 'go-eng-hashicorp',
        title: 'Go Software Engineer',
        company: 'HashiCorp',
        location: 'Remote (Global)',
        salary_range: '$140k–$210k',
        required_skills: ['Go', 'Distributed Systems', 'Networking', 'Linux', 'Open Source'],
        nice_to_have: ['Terraform', 'Consul', 'Vault', 'HCL'],
        level: 'mid',
        category: 'infrastructure'
    },
    {
        id: 'ds-eng-airbnb',
        title: 'Data Scientist',
        company: 'Airbnb',
        location: 'San Francisco, CA (Hybrid)',
        salary_range: '$160k–$240k',
        required_skills: ['Python', 'SQL', 'Statistics', 'Machine Learning', 'A/B Testing'],
        nice_to_have: ['Spark', 'Causal Inference', 'Deep Learning', 'Product Sense'],
        level: 'mid',
        category: 'data'
    },
    {
        id: 'fe-eng-notion',
        title: 'Frontend Engineer',
        company: 'Notion',
        location: 'San Francisco, CA (Hybrid)',
        salary_range: '$150k–$230k',
        required_skills: ['React', 'TypeScript', 'CSS', 'Block Editor', 'Performance'],
        nice_to_have: ['Collaborative Editing', 'Offline Sync', 'Electron', 'WASM'],
        level: 'mid',
        category: 'frontend'
    },
    {
        id: 'sr-be-uber',
        title: 'Senior Backend Engineer',
        company: 'Uber',
        location: 'San Francisco, CA (Hybrid)',
        salary_range: '$180k–$280k',
        required_skills: ['Go', 'Java', 'Microservices', 'Distributed Systems', 'Kafka'],
        nice_to_have: ['Cassandra', 'gRPC', 'Real-time Systems', 'Geo-spatial'],
        level: 'senior',
        category: 'backend'
    }
];
