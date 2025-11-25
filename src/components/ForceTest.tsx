// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

interface Node {
  id: string;
  title: string;
  image: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

// Sample 5-node necklace
const placeholderData = {
  nodes: [
    { id: "n0", title: "Node 0", image: "https://placehold.co/60x60" },
    { id: "n1", title: "Node 1", image: "https://placehold.co/60x60" },
    { id: "n2", title: "Node 2", image: "https://placehold.co/60x60" },
    { id: "n3", title: "Node 3", image: "https://placehold.co/60x60" },
    { id: "n4", title: "Node 4", image: "https://placehold.co/60x60" },
  ],
};

function multiSegmentWavyPathStable(
  source: Node,
  target: Node,
  segmentOffsets: [number, number][]
) {
  const points: [number, number][] = [];
  const segments = segmentOffsets.length - 1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const [offsetX, offsetY] = segmentOffsets[i];
    const x = source.x! + (target.x! - source.x!) * t + offsetX;
    const y = source.y! + (target.y! - source.y!) * t + offsetY;
    points.push([x, y]);
  }

  const lineGenerator = d3
    .line<[number, number]>()
    .curve(d3.curveCardinal)
    .x((d) => d[0])
    .y((d) => d[1]);

  return lineGenerator(points) as string;
}

export default function NecklaceGraph() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);

  // Dynamic configuration
  const config = useMemo(
    () => ({
      width: 1200,
      height: 1000,
      nodeSize: 60,
      radiusFactor: 0.4,
      collisionPadding: 5,
      snapStrength: 0.03,
      jitterStrength: 0.01,
      numSegments: 6
    }),
    []
  );

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const {
      width,
      height,
      nodeSize,
      radiusFactor,
      collisionPadding,
      snapStrength,
    } = config;
    const nodeRadius = nodeSize / 2;
    const radius = Math.min(width, height) * radiusFactor;

    const nodes: Node[] = placeholderData.nodes;
    const n = nodes.length;

    // Compute circular targets
    const targets = nodes.map((_, i) => {
      const angle = (i / n) * 2 * Math.PI;
      return {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      };
    });

    // Build links
    const links: Link[] = nodes.map((node, i) => ({
      source: nodes[i],
      target: nodes[(i + 1) % n],
    }));
    // Initialize positions
    nodes.forEach((node, i) => {
      node.x = targets[i].x;
      node.y = targets[i].y;
    });

    // Before the simulation, attach a small random offset to each link
    links.forEach((link) => {
      const segments = config.numSegments; // or whatever you want
      const maxOffset = 20;
      (link as any).segmentOffsets = Array.from(
        { length: segments + 1 },
        () => [
          (Math.random() - 0.5) * maxOffset, // offsetX
          (Math.random() - 0.5) * maxOffset, // offsetY
        ]
      );
    });

    // Simulation
    const simulation = d3
      .forceSimulation<Node>(nodes)
      .force("charge", d3.forceManyBody().strength(-50))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(nodeRadius + collisionPadding))
      .force("snap", () => {
        // Soft spring back to circular target
        nodes.forEach((node, i) => {
          const target = targets[i];
          node.vx = (node.vx || 0) + (target.x - node.x!) * snapStrength;
          node.vy = (node.vy || 0) + (target.y - node.y!) * snapStrength;
        });
      })
      .alpha(1)
      .alphaDecay(0.001)
      .on("tick", ticked);

    // Draw links
    const link = svg
      .append("g")
      .attr("stroke", "#333")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 1)
      .attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path");

    // Draw nodes as images
    const node = svg
      .append("g")
      .selectAll("image")
      .data(nodes)
      .join("image")
      .attr("href", (d) => d.image)
      .attr("width", nodeSize)
      .attr("height", nodeSize)
      .attr("x", (d) => d.x! - nodeRadius)
      .attr("y", (d) => d.y! - nodeRadius)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGImageElement, Node>()

          .on("drag", (event, d) => {
            d.x = event.x;
            d.y = event.y;
          })
          .on("end", (event, d) => {
            simulation.alphaTarget(0);
          })
      )
      .on("click", (event, d) => setSelected(d));

    // Labels
    const labels = svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.title)
      .attr("font-size", 12)
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none");

    function ticked() {
      // Update nodes
      node
        .attr("x", (d) => d.x! - nodeRadius)
        .attr("y", (d) => d.y! - nodeRadius);

      // Update labels
      labels.attr("x", (d) => d.x!).attr("y", (d) => d.y! - nodeRadius - 5);

      // Update paths (wavy links)
      link.attr("d", (d: Link & { segmentOffsets: [number, number][] }) =>
        multiSegmentWavyPathStable(
          d.source as Node,
          d.target as Node,
          d.segmentOffsets
        )
      );
    }

    return () => simulation.stop();
  }, [config]);

  return (
    <div className="flex flex-col gap-4 w-full items-center">
      <p>Selected node: {selected ? selected.title : "None"}</p>
      <svg ref={svgRef} width={config.width} height={config.height} />
    </div>
  );
}
