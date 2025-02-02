import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MediumArticle {
    title: string;
    link: string;
    pubDate: string;
    content: string;
    author: string;
    categories?: string[];
}

const MediumArticles: React.FC = () => {
    const [articles, setArticles] = useState<MediumArticle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/bunkercoin');

                if (!response.ok) {
                    throw new Error('Failed to fetch articles');
                }

                const data = await response.json();

                if (data.status === 'ok') {
                    setArticles(data.items);
                } else {
                    throw new Error('Invalid feed data');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load articles');
            } finally {
                setIsLoading(false);
            }
        };

        fetchArticles();
    }, []);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const extractReadingTime = (content: string): string => {
        const match = content.match(/(\d+)\s+min\s+read/);
        return match ? match[0] : '5 min read';
    };

    if (isLoading) {
        return (
            <div className="w-full flex justify-center items-center min-h-[100px]">
                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full text-neutral-100">
                <p className="text-center text-sm">Failed to load articles: {error}</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="space-y-2">
                {articles.slice(0, 3).map((article, index) => (
                    <Card
                        key={index}
                        className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700 transition-colors duration-200"
                    >
                        <a href={article.link} target="_blank" rel="noopener noreferrer">
                            <CardHeader className="py-2 px-4">
                                <div className="flex items-start justify-between gap-4">
                                    <CardTitle className="text-base font-medium text-neutral-100">
                                        {article.title}
                                    </CardTitle>
                                    <ExternalLink className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                                </div>
                            </CardHeader>
                            <CardContent className="py-2 px-4">
                                <div className="flex items-center text-xs text-neutral-400">
                                    <span>{formatDate(article.pubDate)}</span>
                                    <span className="mx-2">•</span>
                                    <span>{extractReadingTime(article.content)}</span>
                                    {article.categories && article.categories.length > 0 && (
                                        <>
                                            <span className="mx-2">•</span>
                                            <span>{article.categories[0]}</span>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </a>
                    </Card>
                ))}
            </div>
            <div className="mt-2 flex justify-center">
                <Button
                    variant="ghost"
                    className="text-neutral-400 border-neutral-700 hover:bg-neutral-800 hover:text-neutral-200"
                    onClick={() => window.location.href = 'https://blog.bunkercoin.io'}
                >
                    View All Posts
                </Button>
            </div>
        </div>
    );
};

export default MediumArticles;