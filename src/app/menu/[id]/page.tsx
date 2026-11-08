import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDetail } from "@/components/product-detail";

export const metadata: Metadata = { title: "Pinecone cafe" };

/** Route params are request-time data, so they're awaited behind Suspense. */
async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetail id={id} />;
}

export default function ProductPage({ params }: PageProps<"/menu/[id]">) {
  return (
    <Suspense fallback={null}>
      <Product params={params} />
    </Suspense>
  );
}
