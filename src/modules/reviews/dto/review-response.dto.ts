export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  jobId: string;
  reviewerId: string;
  createdAt: Date;
}

export interface ListReviewsResponseDto {
  data: ReviewDto[];
  total: number;
  skip: number;
  take: number;
  averageRating: number | null;
}
