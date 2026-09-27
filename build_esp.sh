#!/data/data/com.termux/files/usr/bin/bash
set -e

pkg install -y openjdk-21 wget 2>/dev/null || true

PROJ="$HOME/espmod"
rm -rf "$PROJ"
mkdir -p "$PROJ/src/main/java/com/qx/esp"
mkdir -p "$PROJ/src/main/resources"

cd "$PROJ"

cat > gradle.properties << 'EOF'
org.gradle.jvmargs=-Xmx2G
org.gradle.parallel=true
minecraft_version=1.21.11
yarn_mappings=1.21.11+build.1
loader_version=0.18.4
fabric_version=0.141.3+1.21.11
mod_version=1.0.0
maven_group=com.qx
archives_base_name=qxesp
EOF

cat > settings.gradle << 'EOF'
pluginManagement {
    repositories {
        maven { url 'https://maven.fabricmc.net/' }
        mavenCentral()
        gradlePluginPortal()
    }
}
EOF

cat > build.gradle << 'EOF'
plugins {
    id 'fabric-loom' version '1.11-SNAPSHOT'
    id 'maven-publish'
}

version = project.mod_version
group = project.maven_group
base { archivesName = project.archives_base_name }

dependencies {
    minecraft "com.mojang:minecraft:${project.minecraft_version}"
    mappings "net.fabricmc:yarn:${project.yarn_mappings}:v2"
    modImplementation "net.fabricmc:fabric-loader:${project.loader_version}"
    modImplementation "net.fabricmc.fabric-api:fabric-api:${project.fabric_version}"
}

processResources {
    inputs.property "version", project.version
    filesMatching("fabric.mod.json") { expand "version": project.version }
}

tasks.withType(JavaCompile).configureEach { it.options.release = 21 }

java {
    withSourcesJar()
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}
EOF

cat > src/main/resources/fabric.mod.json << 'EOF'
{
  "schemaVersion": 1,
  "id": "qxesp",
  "version": "${version}",
  "name": "QX ESP",
  "description": "Storage ESP + Chunk Finder.",
  "authors": ["QX"],
  "license": "MIT",
  "environment": "client",
  "entrypoints": {
    "client": ["com.qx.esp.QXEspMod"]
  },
  "depends": {
    "fabricloader": ">=0.18.0",
    "minecraft": "~1.21.11",
    "java": ">=21",
    "fabric-api": "*"
  }
}
EOF

cat > src/main/java/com/qx/esp/QXEspMod.java << 'EOF'
package com.qx.esp;

import net.fabricmc.api.ClientModInitializer;

public class QXEspMod implements ClientModInitializer {
    public static boolean storageEsp = false;
    public static boolean chunkFinder = false;
    public static EspRenderer renderer;

    @Override
    public void onInitializeClient() {
        renderer = new EspRenderer();
        EspCommand.register();
        StorageEsp.register();
        ChunkFinder.register();
    }
}
EOF

cat > src/main/java/com/qx/esp/EspCommand.java << 'EOF'
package com.qx.esp;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.minecraft.text.Text;

public class EspCommand {
    public static void register() {
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registry) -> {
            dispatcher.register(
                ClientCommandManager.literal("espstorage")
                    .then(ClientCommandManager.argument("state", StringArgumentType.word())
                        .suggests((ctx, b) -> { b.suggest("on"); b.suggest("off"); return b.buildFuture(); })
                        .executes(ctx -> {
                            String s = StringArgumentType.getString(ctx, "state");
                            QXEspMod.storageEsp = s.equalsIgnoreCase("on");
                            ctx.getSource().sendFeedback(Text.literal("[QX] espstorage " + (QXEspMod.storageEsp ? "ON" : "OFF")));
                            return 1;
                        }))
            );
            dispatcher.register(
                ClientCommandManager.literal("chunkfinder")
                    .then(ClientCommandManager.argument("state", StringArgumentType.word())
                        .suggests((ctx, b) -> { b.suggest("on"); b.suggest("off"); return b.buildFuture(); })
                        .executes(ctx -> {
                            String s = StringArgumentType.getString(ctx, "state");
                            QXEspMod.chunkFinder = s.equalsIgnoreCase("on");
                            ctx.getSource().sendFeedback(Text.literal("[QX] chunkfinder " + (QXEspMod.chunkFinder ? "ON" : "OFF")));
                            return 1;
                        }))
            );
        });
    }
}
EOF

cat > src/main/java/com/qx/esp/EspRenderer.java << 'EOF'
package com.qx.esp;

import com.mojang.blaze3d.buffers.GpuBuffer;
import com.mojang.blaze3d.buffers.GpuBufferSlice;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.platform.DepthTestFunction;
import com.mojang.blaze3d.systems.CommandEncoder;
import com.mojang.blaze3d.systems.RenderPass;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.BufferBuilder;
import com.mojang.blaze3d.vertex.ByteBufferBuilder;
import com.mojang.blaze3d.vertex.MeshData;
import com.mojang.blaze3d.vertex.VertexFormat;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gl.MappableRingBuffer;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.render.RenderType;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.Box;
import org.joml.Matrix4f;
import org.joml.Vector3f;
import org.joml.Vector4f;
import org.lwjgl.system.MemoryUtil;

import java.util.OptionalDouble;
import java.util.OptionalInt;

public class EspRenderer {

    public static final RenderPipeline LINES_PIPELINE = RenderPipelines.register(
        RenderPipeline.builder(RenderPipelines.LINES_SNIPPET)
            .withLocation(Identifier.of("qxesp", "pipeline/lines"))
            .withDepthTestFunction(DepthTestFunction.NO_DEPTH_TEST)
            .build()
    );

    public static final RenderPipeline FILLED_PIPELINE = RenderPipelines.register(
        RenderPipeline.builder(RenderPipelines.DEBUG_FILLED_SNIPPET)
            .withLocation(Identifier.of("qxesp", "pipeline/filled"))
            .withDepthTestFunction(DepthTestFunction.NO_DEPTH_TEST)
            .build()
    );

    private static final Vector4f COLOR_MODULATOR = new Vector4f(1f, 1f, 1f, 1f);
    private static final Vector3f MODEL_OFFSET = new Vector3f();
    private static final Matrix4f TEXTURE_MATRIX = new Matrix4f();

    private final ByteBufferBuilder allocator = new ByteBufferBuilder(RenderType.SMALL_BUFFER_SIZE);
    private BufferBuilder lineBuffer;
    private BufferBuilder fillBuffer;
    private MappableRingBuffer lineVB;
    private MappableRingBuffer fillVB;

    // ===== extraction phase =====

    public void beginLines() {
        if (lineBuffer == null) {
            lineBuffer = new BufferBuilder(allocator,
                LINES_PIPELINE.getVertexFormatMode(),
                LINES_PIPELINE.getVertexFormat());
        }
    }

    public void beginFill() {
        if (fillBuffer == null) {
            fillBuffer = new BufferBuilder(allocator,
                FILLED_PIPELINE.getVertexFormatMode(),
                FILLED_PIPELINE.getVertexFormat());
        }
    }

    public void line(Matrix4f m, double x1, double y1, double z1, double x2, double y2, double z2,
                     float r, float g, float b, float a) {
        lineBuffer.addVertex(m, (float) x1, (float) y1, (float) z1).setColor(r, g, b, a);
        lineBuffer.addVertex(m, (float) x2, (float) y2, (float) z2).setColor(r, g, b, a);
    }

    public void boxLines(Matrix4f m, Box box, float r, float g, float b, float a) {
        float x1 = (float) box.minX, y1 = (float) box.minY, z1 = (float) box.minZ;
        float x2 = (float) box.maxX, y2 = (float) box.maxY, z2 = (float) box.maxZ;
        line(m, x1, y1, z1, x2, y1, z1, r, g, b, a);
        line(m, x2, y1, z1, x2, y1, z2, r, g, b, a);
        line(m, x2, y1, z2, x1, y1, z2, r, g, b, a);
        line(m, x1, y1, z2, x1, y1, z1, r, g, b, a);
        line(m, x1, y2, z1, x2, y2, z1, r, g, b, a);
        line(m, x2, y2, z1, x2, y2, z2, r, g, b, a);
        line(m, x2, y2, z2, x1, y2, z2, r, g, b, a);
        line(m, x1, y2, z2, x1, y2, z1, r, g, b, a);
        line(m, x1, y1, z1, x1, y2, z1, r, g, b, a);
        line(m, x2, y1, z1, x2, y2, z1, r, g, b, a);
        line(m, x2, y1, z2, x2, y2, z2, r, g, b, a);
        line(m, x1, y1, z2, x1, y2, z2, r, g, b, a);
    }

    public void boxFill(Matrix4f m, Box box, float r, float g, float b, float a) {
        float x1 = (float) box.minX, y1 = (float) box.minY, z1 = (float) box.minZ;
        float x2 = (float) box.maxX, y2 = (float) box.maxY, z2 = (float) box.maxZ;
        // -Z
        fillBuffer.addVertex(m, x1, y1, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y1, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y2, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x1, y2, z1).setColor(r, g, b, a);
        // +Z
        fillBuffer.addVertex(m, x1, y1, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x1, y2, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y2, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y1, z2).setColor(r, g, b, a);
        // -X
        fillBuffer.addVertex(m, x1, y1, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x1, y2, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x1, y2, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x1, y1, z2).setColor(r, g, b, a);
        // +X
        fillBuffer.addVertex(m, x2, y1, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y1, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y2, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y2, z1).setColor(r, g, b, a);
        // -Y
        fillBuffer.addVertex(m, x1, y1, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x1, y1, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y1, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y1, z1).setColor(r, g, b, a);
        // +Y
        fillBuffer.addVertex(m, x1, y2, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y2, z1).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x2, y2, z2).setColor(r, g, b, a);
        fillBuffer.addVertex(m, x1, y2, z2).setColor(r, g, b, a);
    }

    // ===== drawing phase =====

    public void drawLines(MinecraftClient client) {
        if (lineBuffer == null) return;
        MeshData built = lineBuffer.buildOrThrow();
        lineVB = upload(lineVB, built, "qxesp-lines");
        execute(client, LINES_PIPELINE, built, lineVB);
        built.close();
        lineVB.rotate();
        lineBuffer = null;
    }

    public void drawFill(MinecraftClient client) {
        if (fillBuffer == null) return;
        MeshData built = fillBuffer.buildOrThrow();
        fillVB = upload(fillVB, built, "qxesp-fill");
        execute(client, FILLED_PIPELINE, built, fillVB);
        built.close();
        fillVB.rotate();
        fillBuffer = null;
    }

    private MappableRingBuffer upload(MappableRingBuffer existing, MeshData built, String name) {
        VertexFormat fmt = built.drawState().format();
        int size = built.drawState().vertexCount() * fmt.getVertexSize();
        MappableRingBuffer buf = existing;
        if (buf == null || buf.size() < size) {
            if (buf != null) buf.close();
            buf = new MappableRingBuffer(() -> name,
                GpuBuffer.USAGE_VERTEX | GpuBuffer.USAGE_MAP_WRITE, size);
        }
        CommandEncoder enc = RenderSystem.getDevice().createCommandEncoder();
        try (GpuBuffer.MappedView view = enc.mapBuffer(
                buf.currentBuffer().slice(0, built.vertexBuffer().remaining()), false, true)) {
            MemoryUtil.memCopy(built.vertexBuffer(), view.data());
        }
        return buf;
    }

    private void execute(MinecraftClient client, RenderPipeline pipeline, MeshData built, MappableRingBuffer vb) {
        MeshData.DrawState draw = built.drawState();
        VertexFormat fmt = draw.format();
        GpuBuffer indices;
        VertexFormat.IndexType indexType;
        if (pipeline.getVertexFormatMode() == VertexFormat.Mode.QUADS) {
            built.sortQuads(allocator, RenderSystem.getProjectionType().vertexSorting());
            indices = pipeline.getVertexFormat().uploadImmediateIndexBuffer(built.indexBuffer());
            indexType = draw.indexType();
        } else {
            RenderSystem.AutoStorageIndexBuffer shape = RenderSystem.getSequentialBuffer(pipeline.getVertexFormatMode());
            indices = shape.getBuffer(draw.indexCount());
            indexType = shape.type();
        }
        GpuBufferSlice transforms = RenderSystem.getDynamicUniforms()
            .writeTransform(RenderSystem.getModelViewMatrix(), COLOR_MODULATOR, MODEL_OFFSET, TEXTURE_MATRIX);
        try (RenderPass pass = RenderSystem.getDevice().createCommandEncoder()
                .createRenderPass(() -> "qxesp-pipeline",
                    client.getMainRenderTarget().getColorTextureView(), OptionalInt.empty(),
                    client.getMainRenderTarget().getDepthTextureView(), OptionalDouble.empty())) {
            pass.setPipeline(pipeline);
            RenderSystem.bindDefaultUniforms(pass);
            pass.setUniform("DynamicTransforms", transforms);
            pass.setVertexBuffer(0, vb.currentBuffer());
            pass.setIndexBuffer(indices, indexType);
            pass.drawIndexed(0, 0, draw.indexCount(), 1);
        }
    }

    public void close() {
        allocator.close();
        if (lineVB != null) { lineVB.close(); lineVB = null; }
        if (fillVB != null) { fillVB.close(); fillVB = null; }
    }
}
EOF

cat > src/main/java/com/qx/esp/StorageEsp.java << 'EOF'
package com.qx.esp;

import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.block.entity.*;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.chunk.WorldChunk;
import org.joml.Matrix4f;

public class StorageEsp {

    public static void register() {
        WorldRenderEvents.AFTER_ENTITIES.register(context -> {
            if (!QXEspMod.storageEsp) return;
            MinecraftClient mc = MinecraftClient.getInstance();
            if (mc.world == null || mc.player == null) return;

            MatrixStack matrices = context.matrixStack();
            if (matrices == null) return;

            EspRenderer r = QXEspMod.renderer;
            r.beginLines();
            r.beginFill();

            var camPos = context.camera().getPos();
            matrices.push();
            matrices.translate(-camPos.x, -camPos.y, -camPos.z);
            Matrix4f mat = matrices.peek().getPositionMatrix();

            int rd = Math.min(8, mc.options.getViewDistance().getValue());
            ChunkPos center = mc.player.getChunkPos();

            for (int dx = -rd; dx <= rd; dx++) {
                for (int dz = -rd; dz <= rd; dz++) {
                    WorldChunk chunk = mc.world.getChunk(center.x + dx, center.z + dz);
                    if (chunk == null) continue;
                    for (BlockEntity be : chunk.getBlockEntities().values()) {
                        float[] c = colorFor(be);
                        if (c == null) continue;
                        Box box = new Box(be.getPos()).expand(0.002);
                        r.boxLines(mat, box, c[0], c[1], c[2], 1.0f);
                        r.boxFill(mat, box, c[0], c[1], c[2], 0.15f);
                    }
                }
            }

            matrices.pop();
            r.drawFill(mc);
            r.drawLines(mc);
        });
    }

    private static float[] colorFor(BlockEntity be) {
        if (be instanceof ChestBlockEntity) return new float[]{1f, 0.6f, 0f};
        if (be instanceof EnderChestBlockEntity) return new float[]{0.6f, 0f, 1f};
        if (be instanceof ShulkerBoxBlockEntity) return new float[]{1f, 0f, 1f};
        if (be instanceof BarrelBlockEntity) return new float[]{0.8f, 0.6f, 0.3f};
        if (be instanceof HopperBlockEntity) return new float[]{0.4f, 0.4f, 0.4f};
        return null;
    }
}
EOF

cat > src/main/java/com/qx/esp/ChunkFinder.java << 'EOF'
package com.qx.esp;

import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.block.Blocks;
import net.minecraft.block.entity.*;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.world.chunk.ChunkSection;
import net.minecraft.world.chunk.WorldChunk;
import org.joml.Matrix4f;

import java.util.ArrayList;
import java.util.List;

public class ChunkFinder {

    private static final int VEG_THRESHOLD   = 800;
    private static final int MOB_THRESHOLD   = 6;
    private static final int CHEST_THRESHOLD = 8;

    public static void register() {
        WorldRenderEvents.AFTER_ENTITIES.register(context -> {
            if (!QXEspMod.chunkFinder) return;
            MinecraftClient mc = MinecraftClient.getInstance();
            if (mc.world == null || mc.player == null) return;

            MatrixStack matrices = context.matrixStack();
            if (matrices == null) return;

            int rd = Math.min(8, mc.options.getViewDistance().getValue());
            ChunkPos center = mc.player.getChunkPos();

            List<ChunkPos> hits = new ArrayList<>();
            for (int dx = -rd; dx <= rd; dx++) {
                for (int dz = -rd; dz <= rd; dz++) {
                    int cx = center.x + dx, cz = center.z + dz;
                    WorldChunk chunk = mc.world.getChunk(cx, cz);
                    if (chunk == null) continue;
                    if (evaluate(chunk, mc)) hits.add(new ChunkPos(cx, cz));
                }
            }

            if (hits.isEmpty()) return;

            EspRenderer r = QXEspMod.renderer;
            r.beginLines();
            r.beginFill();

            var camPos = context.camera().getPos();
            matrices.push();
            matrices.translate(-camPos.x, -camPos.y, -camPos.z);
            Matrix4f mat = matrices.peek().getPositionMatrix();

            int minY = mc.world.getBottomY();
            int maxY = mc.world.getTopYInclusive() + 1;

            for (ChunkPos cp : hits) {
                Box b = new Box(cp.getStartX(), minY, cp.getStartZ(),
                    cp.getStartX() + 16, maxY, cp.getStartZ() + 16);
                r.boxFill(mat, b, 1f, 0f, 0f, 0.10f);
                r.boxLines(mat, b, 1f, 0.2f, 0.2f, 0.9f);
            }

            matrices.pop();
            r.drawFill(mc);
            r.drawLines(mc);
        });
    }

    private static boolean evaluate(WorldChunk chunk, MinecraftClient mc) {
        int veg = 0, chests = 0;

        ChunkSection[] sections = chunk.getSectionArray();
        for (ChunkSection sec : sections) {
            if (sec == null || sec.isEmpty()) continue;
            for (int x = 0; x < 16; x++) {
                for (int y = 0; y < 16; y++) {
                    for (int z = 0; z < 16; z++) {
                        var block = sec.getBlockState(x, y, z).getBlock();
                        if (block == Blocks.OAK_LEAVES || block == Blocks.JUNGLE_LEAVES ||
                            block == Blocks.DARK_OAK_LEAVES || block == Blocks.SPRUCE_LEAVES ||
                            block == Blocks.BIRCH_LEAVES || block == Blocks.ACACIA_LEAVES ||
                            block == Blocks.MANGROVE_LEAVES || block == Blocks.CHERRY_LEAVES ||
                            block == Blocks.SHORT_GRASS || block == Blocks.TALL_GRASS ||
                            block == Blocks.FERN || block == Blocks.LARGE_FERN) {
                            veg++;
                        }
                    }
                }
            }
        }

        for (BlockEntity be : chunk.getBlockEntities().values()) {
            if (be instanceof ChestBlockEntity || be instanceof BarrelBlockEntity ||
                be instanceof HopperBlockEntity || be instanceof ShulkerBoxBlockEntity) chests++;
        }

        int mobs = 0;
        Box cb = new Box(chunk.getPos().getStartX(), mc.world.getBottomY(), chunk.getPos().getStartZ(),
            chunk.getPos().getStartX() + 16, mc.world.getTopYInclusive() + 1, chunk.getPos().getStartZ() + 16);
        for (var ignored : mc.world.getEntitiesByClass(MobEntity.class, cb, e -> true)) mobs++;

        return veg >= VEG_THRESHOLD || mobs >= MOB_THRESHOLD || chests >= CHEST_THRESHOLD;
    }
}
EOF

echo ""
echo "[ build ] jalanin gradle..."
cd "$PROJ"
gradle build --no-daemon || {
  echo ""
  echo "!! Build gagal. Paste error-nya, gue patch."
  exit 1
}

JAR=$(find "$PROJ/build/libs" -name "qxesp-*.jar" ! -name "*sources*" | head -1)
echo ""
echo "=== SELESAI ==="
echo "JAR: $JAR"
echo ""
echo "Copy ke folder mods:"
echo "  cp \"$JAR\" /sdcard/Download/"
